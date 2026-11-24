use reqwest::{Client, Method, Url};
use serde::Serialize;
use std::sync::OnceLock;
use std::time::Duration;

const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

fn client() -> Result<&'static Client, String> {
  static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();
  CLIENT
    .get_or_init(|| {
      Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| error.to_string())
    })
    .as_ref()
    .map_err(Clone::clone)
}

fn validate_request(url: &str, method: &str) -> Result<(Url, Method), String> {
  let url = Url::parse(url).map_err(|_| "Invalid website URL")?;
  let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
  if (url.scheme() != "https" && !(url.scheme() == "http" && loopback))
    || !url.username().is_empty()
    || url.password().is_some()
    || url.query().is_some()
    || url.fragment().is_some()
  {
    return Err("Invalid website origin".into());
  }
  if !loopback
    && !(matches!(url.host_str(), Some("marshell.bond" | "www.marshell.bond"))
      && url.port_or_known_default() == Some(443))
  {
    return Err("Unsupported website origin".into());
  }
  let expected_method = match url.path() {
    "/api/desktop/auth/token" | "/api/desktop/auth/refresh" => "POST",
    _ => return Err("Unsupported website endpoint".into()),
  };
  if method != expected_method {
    return Err("Unsupported website request method".into());
  }
  let method = Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid request method")?;
  Ok((url, method))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebsiteResponse {
  status: u16,
  body: String,
  content_type: String,
  request_id: Option<String>,
  server_timing: Option<String>,
}

/// Account auth requests share DNS/TLS state and keep-alive connections across IPC calls.
#[tauri::command]
pub async fn website_request(
  url: String,
  method: String,
  authorization: Option<String>,
  body: Option<String>,
  installation_proof: Option<String>,
) -> Result<WebsiteResponse, String> {
  let (url, method) = validate_request(&url, &method)?;
  if installation_proof.is_some() {
    return Err("Unsupported request header".into());
  }
  let mut request = client()?
    .request(method, url)
    .header("Accept", "application/json")
    .header("X-Marshell-Version", env!("CARGO_PKG_VERSION"));
  if let Some(authorization) = authorization {
    request = request.header("Authorization", authorization);
  }
  if let Some(body) = body {
    request = request
      .header("Content-Type", "application/json")
      .body(body);
  }
  let mut response = request.send().await.map_err(|_| "Website request failed")?;
  let status = response.status().as_u16();
  let content_type = response
    .headers()
    .get("content-type")
    .and_then(|value| value.to_str().ok())
    .unwrap_or("application/json")
    .to_owned();
  let request_id = response.headers().get("x-request-id").and_then(|v| v.to_str().ok()).map(str::to_owned);
  let server_timing = response.headers().get("server-timing").and_then(|v| v.to_str().ok()).map(str::to_owned);
  let mut bytes = Vec::new();
  while let Some(chunk) = response
    .chunk()
    .await
    .map_err(|_| "Could not read website response")?
  {
    if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES {
      return Err("Website response exceeded size limit".into());
    }
    bytes.extend_from_slice(&chunk);
  }
  let body = String::from_utf8(bytes).map_err(|_| "Invalid website response encoding")?;
  Ok(WebsiteResponse {
    status,
    body,
    content_type,
    request_id,
    server_timing,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use axum::{extract::ConnectInfo, routing::post, Router};
  use std::net::SocketAddr;

  #[test]
  fn rejects_unexpected_endpoints_and_insecure_origins() {
    for (url, method) in [
      ("https://marshell.bond/api/desktop/auth/token", "GET"),
      ("https://marshell.bond/private", "GET"),
      ("https://marshell.bond/api/unknown", "POST"),
      ("https://marshell.bond/api/other", "POST"),
      ("http://marshell.bond/api/desktop/auth/token", "POST"),
      ("https://user:pass@marshell.bond/api/desktop/auth/token", "POST"),
      ("https://attacker.example/api/desktop/auth/token", "POST"),
      ("https://marshell.bond/api/desktop/auth/token?token=secret", "POST"),
    ] {
      assert!(validate_request(url, method).is_err(), "expected error for {url}");
    }
    assert!(validate_request("https://marshell.bond/api/desktop/auth/token", "POST").is_ok());
    assert!(validate_request("https://marshell.bond/api/desktop/auth/refresh", "POST").is_ok());
    assert!(validate_request("http://localhost:3002/api/desktop/auth/token", "POST").is_ok());
  }

  #[tokio::test]
  async fn reuses_the_connection_and_preserves_error_responses() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let app = Router::new().route(
      "/api/desktop/auth/refresh",
      post(|ConnectInfo(peer): ConnectInfo<SocketAddr>| async move {
        (
          axum::http::StatusCode::SERVICE_UNAVAILABLE,
          peer.to_string(),
        )
      }),
    );
    let server = tokio::spawn(async move {
      axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
      )
      .await
      .unwrap();
    });
    let url = format!("http://{address}/api/desktop/auth/refresh");
    let first = website_request(url.clone(), "POST".into(), None, None, None)
      .await
      .unwrap();
    let second = website_request(url, "POST".into(), None, None, None)
      .await
      .unwrap();
    server.abort();
    assert_eq!(first.status, 503);
    assert_eq!(second.status, 503);
    assert_eq!(
      first.body, second.body,
      "requests should use the same TCP connection"
    );
  }
}
