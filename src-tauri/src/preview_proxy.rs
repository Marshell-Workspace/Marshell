//! In-app web preview support.
//!
//! A dev server cannot normally be shown inside the app: it may forbid framing (CSP
//! `frame-ancestors`, `X-Frame-Options`) and the app cannot reach into a cross-origin page
//! to inspect it. So each previewed dev server gets its own loopback proxy listener that
//!
//! * strips the frame-blocking response headers,
//! * injects Marshell's devtools / component-inspector scripts into HTML pages,
//! * rewrites redirects back onto the proxy, and
//! * bridges WebSockets so hot-reload keeps working.
//!
//! One listener per target port (rather than host-name routing) means every preview gets a
//! distinct origin without depending on `*.localhost` DNS behaviour in each system webview.

use axum::{
    body::Body,
    extract::{
        ws::{Message as AxMessage, WebSocket, WebSocketUpgrade},
        Request, State,
    },
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message as WsMessage};

const BIPPY: &str = include_str!("../../public/scripts/bippy_bundle.js");
const DEVTOOLS: &str = include_str!("../../public/scripts/devtools_script.js");
const INSPECTOR: &str = include_str!("../../public/scripts/click_to_component_script.js");
const ERUDA: &str = include_str!("../../public/scripts/eruda.js");

const ASSET_PREFIX: &str = "/__marshell/";
const INJECTED_TAGS: &str = concat!(
    "<script src=\"/__marshell/bippy.js\"></script>",
    "<script src=\"/__marshell/devtools.js\"></script>",
    "<script src=\"/__marshell/inspector.js\"></script>"
);
/// HTML larger than this is passed through untouched rather than buffered.
const MAX_HTML_BYTES: usize = 30 * 1024 * 1024;
/// How far into a document to look for `<head>` before giving up.
const HEAD_SCAN_LIMIT: usize = 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const PROBE_TIMEOUT: Duration = Duration::from_millis(300);
const MAX_PROBE_PORTS: usize = 64;

/// Response headers that stop a page being framed or would be wrong after proxying.
const STRIP_RESPONSE_HEADERS: [&str; 6] = [
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "connection",
    "keep-alive",
    "transfer-encoding",
];

/// Request headers that describe the hop to the proxy, not the request itself.
const STRIP_REQUEST_HEADERS: [&str; 10] = [
    "host",
    "connection",
    "keep-alive",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-length",
    // reqwest negotiates (and undoes) compression itself, which HTML injection needs.
    "accept-encoding",
];

struct Ctx {
    target_port: u16,
    proxy_port: u16,
    client: reqwest::Client,
    /// Which loopback address the dev server answers on: 0 unknown, 1 IPv4, 2 IPv6.
    /// Node dev servers often bind `localhost` to `::1` only.
    family: AtomicU8,
}

const FAMILY_UNKNOWN: u8 = 0;
const FAMILY_V4: u8 = 1;
const FAMILY_V6: u8 = 2;

impl Ctx {
    /// The origin a browser visiting the dev server directly would send. Dev servers police
    /// Origin/Host (Next.js rejects a websocket from `127.0.0.1` while accepting `localhost`),
    /// so upstream requests are made to look exactly like that.
    fn browser_origin(&self) -> String {
        format!("http://localhost:{}", self.target_port)
    }

    /// Makes an Origin/Referer the browser sent to the proxy look like it came from the dev
    /// server itself, so its CSRF / host checks pass.
    fn to_target(&self, value: &str) -> String {
        let mut out = value.to_string();
        for host in ["127.0.0.1", "localhost"] {
            out = out.replace(&format!("://{host}:{}", self.proxy_port), &format!("://localhost:{}", self.target_port));
        }
        out
    }

    /// Address to connect to. Probes IPv4 then IPv6 the first time (and again after a
    /// connection failure) instead of assuming.
    async fn upstream_host(&self) -> &'static str {
        if self.family.load(Ordering::Relaxed) == FAMILY_UNKNOWN {
            let family = if can_connect("127.0.0.1", self.target_port).await {
                FAMILY_V4
            } else if can_connect("::1", self.target_port).await {
                FAMILY_V6
            } else {
                FAMILY_UNKNOWN
            };
            self.family.store(family, Ordering::Relaxed);
        }
        if self.family.load(Ordering::Relaxed) == FAMILY_V6 { "[::1]" } else { "127.0.0.1" }
    }

    /// Forget the detected address after a connection error, so the next request re-probes.
    fn connection_failed(&self) {
        self.family.store(FAMILY_UNKNOWN, Ordering::Relaxed);
    }
}

async fn can_connect(host: &str, port: u16) -> bool {
    matches!(tokio::time::timeout(PROBE_TIMEOUT, TcpStream::connect((host, port))).await, Ok(Ok(_)))
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

fn is_hop_header(name: &str, list: &[&str]) -> bool {
    list.iter().any(|h| h.eq_ignore_ascii_case(name))
}

/// Case-insensitive search for an ASCII tag start such as `<head`, skipping HTML comments,
/// and requiring the tag name to end there (so `<header` does not match `<head`).
fn find_tag_end(html: &[u8], tag: &[u8]) -> Option<usize> {
    let limit = html.len().min(HEAD_SCAN_LIMIT);
    let mut i = 0;
    while i < limit {
        if html[i] != b'<' {
            i += 1;
            continue;
        }
        if html[i..].starts_with(b"<!--") {
            match html[i + 4..].windows(3).position(|w| w == b"-->") {
                Some(end) => i += 4 + end + 3,
                None => return None,
            }
            continue;
        }
        let name_end = i + tag.len();
        if name_end < html.len()
            && html[i..name_end].eq_ignore_ascii_case(tag)
            && matches!(html[name_end], b'>' | b'/' | b' ' | b'\t' | b'\n' | b'\r')
        {
            return html[name_end..].iter().position(|&b| b == b'>').map(|p| name_end + p + 1);
        }
        i += 1;
    }
    None
}

/// Where scripts can be inserted without disturbing the document: right after `<head>`,
/// else after `<html>`, else after a doctype (inserting before it would trigger quirks
/// mode), else at the very start.
fn injection_point(html: &[u8]) -> usize {
    find_tag_end(html, b"<head")
        .or_else(|| find_tag_end(html, b"<html"))
        .or_else(|| {
            let start = html.iter().position(|b| !b.is_ascii_whitespace())?;
            if html[start..].len() >= 9 && html[start..start + 9].eq_ignore_ascii_case(b"<!doctype") {
                html[start..].iter().position(|&b| b == b'>').map(|p| start + p + 1)
            } else {
                None
            }
        })
        .unwrap_or(0)
}

fn inject_scripts(html: &[u8]) -> Vec<u8> {
    let at = injection_point(html);
    let mut out = Vec::with_capacity(html.len() + INJECTED_TAGS.len());
    out.extend_from_slice(&html[..at]);
    out.extend_from_slice(INJECTED_TAGS.as_bytes());
    out.extend_from_slice(&html[at..]);
    out
}

/// `http://localhost:3000/next` -> `/next` when the redirect points back at the dev server.
fn rewrite_location(location: &str, target_port: u16) -> String {
    for host in ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"] {
        let prefix = format!("http://{host}:{target_port}");
        if let Some(rest) = location.strip_prefix(&prefix) {
            return if rest.is_empty() { "/".to_string() } else { rest.to_string() };
        }
    }
    location.to_string()
}

fn asset(path: &str) -> Option<&'static str> {
    match path.strip_prefix(ASSET_PREFIX)? {
        "bippy.js" => Some(BIPPY),
        "devtools.js" => Some(DEVTOOLS),
        "inspector.js" => Some(INSPECTOR),
        "eruda.js" => Some(ERUDA),
        _ => None,
    }
}

fn bad_gateway(port: u16, detail: &str) -> Response {
    // Refreshes itself so a dev server that is still starting shows up without a manual reload.
    let body = format!(
        "<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=2>\
         <body style=\"font:14px system-ui;padding:2rem;color:#888\">\
         <p>Waiting for the dev server on port {port}…</p><p style=\"font-size:12px\">{}</p></body>",
        detail.replace('<', "&lt;")
    );
    (StatusCode::BAD_GATEWAY, [(header::CONTENT_TYPE, "text/html; charset=utf-8")], body).into_response()
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

async fn handle(State(ctx): State<Arc<Ctx>>, ws: Option<WebSocketUpgrade>, req: Request) -> Response {
    if let Some(script) = asset(req.uri().path()) {
        return (
            [
                (header::CONTENT_TYPE, "application/javascript; charset=utf-8"),
                (header::CACHE_CONTROL, "no-cache"),
            ],
            script,
        )
            .into_response();
    }
    match ws {
        Some(ws) => proxy_ws(ctx, ws, req).await,
        None => proxy_http(ctx, req).await,
    }
}

async fn proxy_http(ctx: Arc<Ctx>, req: Request) -> Response {
    let (parts, body) = req.into_parts();
    let path_and_query = parts.uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let url = format!("http://{}:{}{path_and_query}", ctx.upstream_host().await, ctx.target_port);

    let mut upstream_req = ctx
        .client
        .request(parts.method.clone(), &url)
        .header(header::HOST, format!("localhost:{}", ctx.target_port));
    for (name, value) in &parts.headers {
        if is_hop_header(name.as_str(), &STRIP_REQUEST_HEADERS) {
            continue;
        }
        let value = match (name.as_str(), value.to_str()) {
            ("origin" | "referer", Ok(v)) => HeaderValue::from_str(&ctx.to_target(v)).unwrap_or_else(|_| value.clone()),
            _ => value.clone(),
        };
        upstream_req = upstream_req.header(name, value);
    }
    if parts.method != Method::GET && parts.method != Method::HEAD {
        upstream_req = upstream_req.body(reqwest::Body::wrap_stream(body.into_data_stream()));
    }

    let upstream = match upstream_req.send().await {
        Ok(r) => r,
        Err(e) => {
            if e.is_connect() {
                ctx.connection_failed();
            }
            return bad_gateway(ctx.target_port, &e.to_string());
        }
    };

    let status = upstream.status();
    let is_html = upstream
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.to_ascii_lowercase().starts_with("text/html"));
    let inject = is_html && parts.method != Method::HEAD && status != StatusCode::NO_CONTENT && status != StatusCode::NOT_MODIFIED;

    let mut headers = HeaderMap::new();
    for (name, value) in upstream.headers() {
        let n = name.as_str();
        if is_hop_header(n, &STRIP_RESPONSE_HEADERS) {
            continue;
        }
        // A rewritten HTML body invalidates these.
        if inject && matches!(n, "content-length" | "etag" | "last-modified" | "content-encoding") {
            continue;
        }
        if n == "location" {
            if let Some(v) = value.to_str().ok().and_then(|v| HeaderValue::from_str(&rewrite_location(v, ctx.target_port)).ok()) {
                headers.append(name.clone(), v);
                continue;
            }
        }
        headers.append(name.clone(), value.clone());
    }

    let body = if inject {
        // Read up to the cap; anything bigger (or unreadable) is not worth instrumenting.
        let mut buf: Vec<u8> = Vec::new();
        let mut stream = upstream.bytes_stream();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(c) => buf.extend_from_slice(&c),
                Err(e) => return bad_gateway(ctx.target_port, &e.to_string()),
            }
            if buf.len() > MAX_HTML_BYTES {
                return bad_gateway(ctx.target_port, "Page too large to preview");
            }
        }
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        Body::from(inject_scripts(&buf))
    } else {
        Body::from_stream(upstream.bytes_stream())
    };

    let mut response = Response::new(body);
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

fn to_upstream(msg: AxMessage) -> Option<WsMessage> {
    match msg {
        AxMessage::Text(t) => Some(WsMessage::Text(t)),
        AxMessage::Binary(b) => Some(WsMessage::Binary(b)),
        AxMessage::Ping(p) => Some(WsMessage::Ping(p)),
        AxMessage::Pong(p) => Some(WsMessage::Pong(p)),
        AxMessage::Close(_) => None,
    }
}

fn to_client(msg: WsMessage) -> Option<AxMessage> {
    match msg {
        WsMessage::Text(t) => Some(AxMessage::Text(t)),
        WsMessage::Binary(b) => Some(AxMessage::Binary(b)),
        WsMessage::Ping(p) => Some(AxMessage::Ping(p)),
        WsMessage::Pong(p) => Some(AxMessage::Pong(p)),
        WsMessage::Close(_) | WsMessage::Frame(_) => None,
    }
}

async fn proxy_ws(ctx: Arc<Ctx>, ws: WebSocketUpgrade, req: Request) -> Response {
    let path_and_query = req.uri().path_and_query().map(|p| p.as_str()).unwrap_or("/");
    let url = format!("ws://{}:{}{path_and_query}", ctx.upstream_host().await, ctx.target_port);
    let mut upstream_req = match url.into_client_request() {
        Ok(r) => r,
        Err(e) => return bad_gateway(ctx.target_port, &e.to_string()),
    };
    // Sub-protocols matter (Vite's HMR socket speaks `vite-hmr`); cookies keep dev auth working.
    for name in ["sec-websocket-protocol", "cookie"] {
        if let Some(v) = req.headers().get(name) {
            upstream_req.headers_mut().insert(HeaderName::from_static(name), v.clone());
        }
    }
    if let Ok(origin) = HeaderValue::from_str(&ctx.browser_origin()) {
        upstream_req.headers_mut().insert(header::ORIGIN, origin);
    }
    if let Ok(host) = HeaderValue::from_str(&format!("localhost:{}", ctx.target_port)) {
        upstream_req.headers_mut().insert(header::HOST, host);
    }

    // Connect first: the dev server decides which sub-protocol is accepted.
    let (upstream, response) = match tokio::time::timeout(CONNECT_TIMEOUT, tokio_tungstenite::connect_async(upstream_req)).await {
        Ok(Ok(pair)) => pair,
        Ok(Err(e)) => {
            ctx.connection_failed();
            return bad_gateway(ctx.target_port, &e.to_string());
        }
        Err(_) => {
            ctx.connection_failed();
            return bad_gateway(ctx.target_port, "WebSocket connect timed out");
        }
    };
    let ws = match response.headers().get("sec-websocket-protocol").and_then(|v| v.to_str().ok()) {
        Some(p) => ws.protocols([p.to_string()]),
        None => ws,
    };
    ws.on_upgrade(move |client| bridge(client, upstream))
}

async fn bridge(client: WebSocket, upstream: tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>) {
    let (mut client_tx, mut client_rx) = client.split();
    let (mut upstream_tx, mut upstream_rx) = upstream.split();

    let to_server = async {
        while let Some(Ok(msg)) = client_rx.next().await {
            match to_upstream(msg) {
                Some(m) => {
                    if upstream_tx.send(m).await.is_err() {
                        break;
                    }
                }
                None => break,
            }
        }
        let _ = upstream_tx.send(WsMessage::Close(None)).await;
    };
    let to_browser = async {
        while let Some(Ok(msg)) = upstream_rx.next().await {
            match to_client(msg) {
                Some(m) => {
                    if client_tx.send(m).await.is_err() {
                        break;
                    }
                }
                None => break,
            }
        }
        let _ = client_tx.send(AxMessage::Close(None)).await;
    };
    tokio::select! { _ = to_server => {}, _ = to_browser => {} }
}

// ---------------------------------------------------------------------------
// Listener registry and Tauri commands
// ---------------------------------------------------------------------------

struct Running {
    proxy_port: u16,
    task: JoinHandle<()>,
}

static PROXIES: OnceLock<Mutex<HashMap<u16, Running>>> = OnceLock::new();

fn proxies() -> &'static Mutex<HashMap<u16, Running>> {
    PROXIES.get_or_init(|| Mutex::new(HashMap::new()))
}

async fn spawn_proxy(target_port: u16) -> Result<Running, String> {
    let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
    let proxy_port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(CONNECT_TIMEOUT)
        .no_proxy()
        .build()
        .map_err(|e| e.to_string())?;
    let app = Router::new()
        .fallback(handle)
        .with_state(Arc::new(Ctx { target_port, proxy_port, client, family: AtomicU8::new(FAMILY_UNKNOWN) }));
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    Ok(Running { proxy_port, task })
}

/// Starts (or reuses) the proxy for a dev server port and returns the origin to load.
#[tauri::command]
pub async fn preview_proxy_start(target_port: u16) -> Result<String, String> {
    if target_port == 0 {
        return Err("Invalid port".to_string());
    }
    if let Some(existing) = proxies().lock().unwrap().get(&target_port) {
        if !existing.task.is_finished() {
            return Ok(format!("http://127.0.0.1:{}", existing.proxy_port));
        }
    }
    let running = spawn_proxy(target_port).await?;
    let origin = format!("http://127.0.0.1:{}", running.proxy_port);
    if let Some(old) = proxies().lock().unwrap().insert(target_port, running) {
        old.task.abort();
    }
    Ok(origin)
}

#[tauri::command]
pub async fn preview_proxy_stop(target_port: u16) -> Result<(), String> {
    if let Some(running) = proxies().lock().unwrap().remove(&target_port) {
        running.task.abort();
    }
    Ok(())
}

/// Which of these ports currently accept connections (e.g. the usual dev-server ports).
#[tauri::command]
pub async fn preview_probe_ports(ports: Vec<u16>) -> Result<Vec<u16>, String> {
    let checks = ports.into_iter().take(MAX_PROBE_PORTS).map(|port| async move {
        let alive = can_connect("127.0.0.1", port).await || can_connect("::1", port).await;
        alive.then_some(port)
    });
    let mut alive: Vec<u16> = futures_util::future::join_all(checks).await.into_iter().flatten().collect();
    alive.sort_unstable();
    Ok(alive)
}

/// Ports listened on by this workspace's background processes and terminal shells
/// (including everything they spawned), so the preview URL can fill itself in.
#[tauri::command]
pub async fn preview_detect_ports(
    workspace_id: String,
    terminal_ids: Vec<String>,
) -> Result<Vec<crate::proc_inspect::ListeningPort>, String> {
    tokio::task::spawn_blocking(move || {
        let mut roots = crate::process_supervisor::workspace_pids(&workspace_id);
        roots.extend(terminal_ids.iter().filter_map(|id| crate::terminal::terminal_pid(id)));
        if roots.is_empty() {
            return Vec::new();
        }
        let owned = crate::proc_inspect::descendants(&crate::proc_inspect::cached_process_tree(), &roots);
        crate::proc_inspect::cached_listening_ports().into_iter().filter(|p| owned.contains(&p.pid)).collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::get, routing::post};
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    #[test]
    fn injects_after_head_not_header_or_comments() {
        let html = b"<!doctype html><html><!-- <head> --><header>x</header><HEAD lang=a><title>t</title></head><body/>";
        let out = String::from_utf8(inject_scripts(html)).unwrap();
        let head = out.find("<HEAD lang=a>").unwrap() + "<HEAD lang=a>".len();
        assert_eq!(&out[head..head + 8], "<script ");
        assert_eq!(out.matches("<script ").count(), 3);
    }

    #[test]
    fn falls_back_to_html_then_doctype_then_start() {
        let a = String::from_utf8(inject_scripts(b"<!doctype html><html><body>x</body></html>")).unwrap();
        assert!(a.contains("<html><script"));
        let b = String::from_utf8(inject_scripts(b"<!DOCTYPE html>\n<p>x</p>")).unwrap();
        assert!(b.starts_with("<!DOCTYPE html><script"), "must not precede the doctype: {b}");
        let c = String::from_utf8(inject_scripts(b"<p>fragment</p>")).unwrap();
        assert!(c.starts_with("<script"));
    }

    #[test]
    fn rewrites_only_loopback_redirects_to_the_dev_server() {
        assert_eq!(rewrite_location("http://localhost:3000/login?x=1", 3000), "/login?x=1");
        assert_eq!(rewrite_location("http://127.0.0.1:3000", 3000), "/");
        assert_eq!(rewrite_location("https://example.com/x", 3000), "https://example.com/x");
        assert_eq!(rewrite_location("http://localhost:4000/x", 3000), "http://localhost:4000/x");
        assert_eq!(rewrite_location("/relative", 3000), "/relative");
    }

    async fn upstream_server() -> u16 {
        async fn ws_echo(ws: WebSocketUpgrade) -> Response {
            ws.protocols(["vite-hmr"]).on_upgrade(|mut socket| async move {
                while let Some(Ok(msg)) = socket.recv().await {
                    if let AxMessage::Text(t) = msg {
                        let _ = socket.send(AxMessage::Text(format!("echo:{t}"))).await;
                    }
                }
            })
        }
        // Mimics Next.js: an upgrade from anything but a `localhost` origin is refused.
        async fn ws_strict(headers: HeaderMap, ws: WebSocketUpgrade) -> Response {
            let ok = headers
                .get("origin")
                .and_then(|v| v.to_str().ok())
                .is_some_and(|o| o.starts_with("http://localhost:"));
            if !ok {
                return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
            }
            ws.on_upgrade(|mut socket| async move {
                let _ = socket.send(AxMessage::Text("welcome".into())).await;
            })
        }
        let app = Router::new()
            .route(
                "/",
                get(|| async {
                    (
                        [
                            ("content-type", "text/html"),
                            ("x-frame-options", "DENY"),
                            ("content-security-policy", "frame-ancestors 'none'"),
                            ("etag", "\"abc\""),
                        ],
                        "<!doctype html><html><head><title>t</title></head><body>hi</body></html>",
                    )
                }),
            )
            .route("/redir", get(|| async { (StatusCode::FOUND, [("location", "http://localhost:1/x")], "") }))
            .route("/data.json", get(|| async { ([("content-type", "application/json")], "{\"a\":1}") }))
            .route(
                "/echo",
                post(|headers: HeaderMap, body: String| async move {
                    format!(
                        "{body}|host={}|origin={}",
                        headers.get("host").and_then(|v| v.to_str().ok()).unwrap_or(""),
                        headers.get("origin").and_then(|v| v.to_str().ok()).unwrap_or("")
                    )
                }),
            )
            .route("/ws", get(ws_echo))
            .route("/ws-strict", get(ws_strict));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        port
    }

    #[tokio::test]
    async fn proxies_http_strips_headers_injects_and_rewrites() {
        let upstream = upstream_server().await;
        let origin = preview_proxy_start(upstream).await.unwrap();
        // Same target twice reuses the listener.
        assert_eq!(preview_proxy_start(upstream).await.unwrap(), origin);
        let client = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).build().unwrap();

        let page = client.get(format!("{origin}/")).send().await.unwrap();
        assert!(page.headers().get("x-frame-options").is_none());
        assert!(page.headers().get("content-security-policy").is_none());
        assert!(page.headers().get("etag").is_none());
        let html = page.text().await.unwrap();
        assert!(html.contains("<head><script src=\"/__marshell/bippy.js\">"), "{html}");
        assert!(html.contains("<body>hi</body>"));

        let json = client.get(format!("{origin}/data.json")).send().await.unwrap();
        assert_eq!(json.text().await.unwrap(), "{\"a\":1}", "non-HTML must be untouched");

        let script = client.get(format!("{origin}/__marshell/devtools.js")).send().await.unwrap();
        assert!(script.text().await.unwrap().contains("marshell-devtools"));
        let inspector = client.get(format!("{origin}/__marshell/inspector.js")).send().await.unwrap();
        assert!(inspector.text().await.unwrap().contains("marshell-inspector"));

        let echoed = client
            .post(format!("{origin}/echo"))
            .header("origin", &origin)
            .body("payload")
            .send()
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        assert_eq!(echoed, format!("payload|host=localhost:{upstream}|origin=http://localhost:{upstream}"));

        let redirect = client.get(format!("{origin}/redir")).send().await.unwrap();
        assert_eq!(redirect.status(), 302);
        assert_eq!(redirect.headers()["location"], "http://localhost:1/x", "foreign redirects are left alone");

        preview_proxy_stop(upstream).await.unwrap();
    }

    #[tokio::test]
    async fn reports_bad_gateway_when_the_dev_server_is_down() {
        let dead = TcpListener::bind("127.0.0.1:0").await.unwrap().local_addr().unwrap().port();
        let origin = preview_proxy_start(dead).await.unwrap();
        let res = reqwest::get(format!("{origin}/")).await.unwrap();
        assert_eq!(res.status(), 502);
        assert!(res.text().await.unwrap().contains("Waiting for the dev server"));
        preview_proxy_stop(dead).await.unwrap();
    }

    #[tokio::test]
    async fn bridges_websockets_with_subprotocols() {
        let upstream = upstream_server().await;
        let origin = preview_proxy_start(upstream).await.unwrap();
        let mut req = format!("ws://{}/ws", origin.trim_start_matches("http://")).into_client_request().unwrap();
        req.headers_mut().insert("sec-websocket-protocol", "vite-hmr".parse().unwrap());
        let (mut socket, response) = tokio_tungstenite::connect_async(req).await.unwrap();
        assert_eq!(response.headers()["sec-websocket-protocol"], "vite-hmr");

        socket.send(WsMessage::Text("ping".into())).await.unwrap();
        match socket.next().await.unwrap().unwrap() {
            WsMessage::Text(t) => assert_eq!(t, "echo:ping"),
            other => panic!("unexpected frame: {other:?}"),
        }
        preview_proxy_stop(upstream).await.unwrap();
    }

    #[tokio::test]
    async fn presents_a_localhost_origin_like_a_real_browser() {
        let upstream = upstream_server().await;
        let origin = preview_proxy_start(upstream).await.unwrap();
        let req = format!("ws://{}/ws-strict", origin.trim_start_matches("http://")).into_client_request().unwrap();
        let (mut socket, _) = tokio_tungstenite::connect_async(req).await.expect("strict upstream must accept the proxied upgrade");
        match socket.next().await.unwrap().unwrap() {
            WsMessage::Text(t) => assert_eq!(t, "welcome"),
            other => panic!("unexpected frame: {other:?}"),
        }
        preview_proxy_stop(upstream).await.unwrap();
    }

    #[tokio::test]
    async fn reaches_dev_servers_that_only_listen_on_ipv6() {
        let Ok(listener) = TcpListener::bind("[::1]:0").await else { return }; // no IPv6 here
        let port = listener.local_addr().unwrap().port();
        let app = Router::new().route("/", get(|| async { ([("content-type", "text/plain")], "v6 ok") }));
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

        assert_eq!(preview_probe_ports(vec![port]).await.unwrap(), vec![port]);
        let origin = preview_proxy_start(port).await.unwrap();
        assert_eq!(reqwest::get(format!("{origin}/")).await.unwrap().text().await.unwrap(), "v6 ok");
        preview_proxy_stop(port).await.unwrap();
    }

    #[tokio::test]
    async fn probes_ports() {
        let open = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let open_port = open.local_addr().unwrap().port();
        let closed = TcpListener::bind("127.0.0.1:0").await.unwrap().local_addr().unwrap().port();
        assert_eq!(preview_probe_ports(vec![closed, open_port]).await.unwrap(), vec![open_port]);
    }

    /// Serves the real proxy for manual / browser verification:
    /// `PREVIEW_TARGET_PORT=5199 PREVIEW_ORIGIN_FILE=/tmp/origin cargo test --lib -- --ignored serve_for_manual`
    #[tokio::test]
    #[ignore = "manual: keeps the proxy running for browser verification"]
    async fn serve_for_manual_verification() {
        let target: u16 = std::env::var("PREVIEW_TARGET_PORT").unwrap().parse().unwrap();
        let origin = preview_proxy_start(target).await.unwrap();
        if let Ok(path) = std::env::var("PREVIEW_ORIGIN_FILE") {
            std::fs::write(path, &origin).unwrap();
        }
        tokio::time::sleep(Duration::from_secs(1500)).await;
    }
}
