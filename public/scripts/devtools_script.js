/*
 * Injected into every HTML page served through Marshell's preview proxy.
 * Reports navigation state (URL, title, back/forward availability) to the host app
 * and toggles the vendored Eruda devtools on request.
 *
 * Protocol (window.postMessage, both directions carry a `source` tag):
 *   page -> app  { source: 'marshell-devtools', type: 'navigation' | 'eruda-ready', payload }
 *   page -> app  { type: 'runtime-error' | 'network-error' | 'qa-report', payload }
 *   app  -> page { source: 'marshell-app', command: 'back' | 'forward' | 'reload' | 'toggle-eruda' | 'qa-audit' }
 */
(function () {
  'use strict';
  if (window.__marshellDevtools) return;

  var SOURCE = 'marshell-devtools';
  var COMMAND_SOURCE = 'marshell-app';
  var STORAGE_KEY = '__marshell_nav';
  var MAX_STACK = 100;

  // --- Navigation tracker: pure state transitions over {stack, index} -------------------
  // The History API cannot tell a page whether it can go back, so we keep our own stack
  // (persisted in sessionStorage so it survives full-page navigations).
  function createNavTracker(initial) {
    var state = initial && Array.isArray(initial.stack)
      ? { stack: initial.stack.slice(), index: initial.index }
      : { stack: [], index: -1 };
    if (typeof state.index !== 'number' || state.index >= state.stack.length) {
      state.index = state.stack.length - 1;
    }

    function truncateAndPush(href) {
      state.stack = state.stack.slice(0, state.index + 1);
      state.stack.push(href);
      if (state.stack.length > MAX_STACK) state.stack.shift();
      state.index = state.stack.length - 1;
    }

    function nearestIndexOf(href) {
      var best = -1;
      for (var i = 0; i < state.stack.length; i++) {
        if (state.stack[i] !== href) continue;
        if (best === -1 || Math.abs(i - state.index) < Math.abs(best - state.index)) best = i;
      }
      return best;
    }

    return {
      /** kind: 'load' (new document) | 'push' | 'replace' | 'pop' (popstate / hashchange) */
      record: function (kind, href) {
        if (state.index < 0) {
          state = { stack: [href], index: 0 };
          return;
        }
        var current = state.stack[state.index];
        if (kind === 'replace') {
          state.stack[state.index] = href;
        } else if (kind === 'push') {
          truncateAndPush(href);
        } else if (current === href) {
          // reload, or the second event of a popstate + hashchange pair
        } else if (state.stack[state.index + 1] === href) {
          state.index += 1;
        } else if (state.stack[state.index - 1] === href) {
          state.index -= 1;
        } else if (kind === 'pop' && nearestIndexOf(href) !== -1) {
          state.index = nearestIndexOf(href);
        } else {
          truncateAndPush(href);
        }
      },
      snapshot: function () {
        return {
          stack: state.stack.slice(),
          index: state.index,
          canGoBack: state.index > 0,
          canGoForward: state.index < state.stack.length - 1,
        };
      },
    };
  }

  function send(type, payload) {
    try {
      window.parent.postMessage({ source: SOURCE, type: type, payload: payload }, '*');
    } catch (e) {
      // Not embedded, or the parent is unreachable.
    }
  }

  // --- Runtime error capture: thrown exceptions, rejected promises, console.error ----
  function reportError(message, extra) {
    var payload = { message: message };
    if (extra) {
      if (extra.source) payload.source = extra.source;
      if (typeof extra.line === 'number') payload.line = extra.line;
      if (typeof extra.col === 'number') payload.col = extra.col;
      if (extra.stack) payload.stack = extra.stack;
      if (extra.fromConsole) payload.fromConsole = true;
    }
    send('runtime-error', payload);
  }

  window.addEventListener('error', function (e) {
    reportError(e.message || 'Script error', {
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error && e.error.stack,
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    var message = reason && reason.message ? reason.message : String(reason);
    reportError('Unhandled promise rejection: ' + message, {
      stack: reason && reason.stack,
    });
  });

  var realConsoleError = console.error;
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      var message = args
        .map(function (a) { return a instanceof Error ? (a.stack || a.message) : String(a); })
        .join(' ');
      reportError(message, { fromConsole: true });
    } catch (e) {
      // Never let capture itself break the page.
    }
    return realConsoleError.apply(console, arguments);
  };

  // --- Network failures: fetch, XHR and sub-resources (images, scripts, styles) ---------
  var IGNORED_URL = /\/__marshell\/|webpack-hmr|hot-update|\/__nextjs|\/@vite\/|\/@react-refresh/;

  function reportNetwork(kind, method, url, status) {
    var href = String(url);
    if (IGNORED_URL.test(href)) return;
    send('network-error', { kind: kind, method: method, url: href, status: status });
  }

  if (typeof window.fetch === 'function') {
    var realFetch = window.fetch;
    window.fetch = function (input, init) {
      var method = (init && init.method) || (input && input.method) || 'GET';
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      return realFetch.apply(this, arguments).then(function (res) {
        if (res && res.status >= 400) reportNetwork('fetch', method, url, res.status);
        return res;
      }, function (err) {
        reportNetwork('fetch', method, url, 0);
        throw err;
      });
    };
  }

  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype) {
    var xhrProto = window.XMLHttpRequest.prototype;
    var realOpen = xhrProto.open;
    xhrProto.open = function (method, url) {
      var xhr = this;
      xhr.addEventListener('loadend', function () {
        if (xhr.status === 0 || xhr.status >= 400) reportNetwork('xhr', method, url, xhr.status);
      });
      return realOpen.apply(this, arguments);
    };
  }

  // Resource load errors do not bubble, so listen in the capture phase.
  var RESOURCE_TAGS = { IMG: 1, SCRIPT: 1, LINK: 1, VIDEO: 1, AUDIO: 1, SOURCE: 1 };
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (!t || t === window || !t.tagName || !RESOURCE_TAGS[t.tagName]) return;
    reportNetwork('resource', 'GET', t.currentSrc || t.src || t.href || t.tagName, 0);
  }, true);

  // --- Responsive audit: layout facts the host turns into a health summary ---------------
  var MAX_ISSUES = 20;
  var MAX_ELEMENTS = 3000;
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, HEAD: 1, TITLE: 1, BR: 1 };
  var CLIPPING_OVERFLOW = { hidden: 1, auto: 1, scroll: 1, clip: 1 };

  function describe(el) {
    var out = el.tagName.toLowerCase();
    if (el.id) out += '#' + el.id;
    var cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2) : [];
    if (cls[0]) out += '.' + cls.join('.');
    return out.slice(0, 120);
  }

  function isClippedByAncestor(el, body) {
    for (var p = el.parentElement; p && p !== body && p !== document.documentElement; p = p.parentElement) {
      if (CLIPPING_OVERFLOW[getComputedStyle(p).overflowX]) return true;
    }
    return false;
  }

  function hasOwnText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    }
    return false;
  }

  function audit() {
    var body = document.body;
    var root = document.documentElement || {};
    var vw = window.innerWidth;
    var report = {
      blank: false,
      brokenImages: [],
      devicePixelRatio: window.devicePixelRatio || 1,
      documentHeight: root.scrollHeight || 0,
      documentWidth: root.scrollWidth || 0,
      fixedWidth: [],
      hasViewportMeta: !!(document.querySelector && document.querySelector('meta[name="viewport"]')),
      oversizedImages: [],
      overflowing: [],
      smallText: 0,
      textOverflow: [],
      viewportHeight: window.innerHeight,
      viewportWidth: vw,
    };
    if (!body || !body.querySelectorAll || typeof getComputedStyle !== 'function') return report;

    var text = (body.innerText || '').trim();
    report.blank = text === '' && !body.querySelector('img,canvas,svg,video,iframe,input,button');

    var all = body.querySelectorAll('*');
    var count = Math.min(all.length, MAX_ELEMENTS);
    for (var i = 0; i < count; i++) {
      var el = all[i];
      if (SKIP_TAGS[el.tagName]) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      if (el.tagName === 'IMG') {
        if (el.complete && el.naturalWidth === 0 && (el.currentSrc || el.src)) {
          if (report.brokenImages.length < MAX_ISSUES) {
            report.brokenImages.push({ selector: describe(el), detail: el.currentSrc || el.src });
          }
        } else if (r.width > vw + 1 && report.oversizedImages.length < MAX_ISSUES) {
          report.oversizedImages.push({ selector: describe(el), detail: Math.round(r.width) + 'px wide' });
        }
      }

      if (r.right > vw + 1 && report.overflowing.length < MAX_ISSUES && !isClippedByAncestor(el, body)) {
        report.overflowing.push({ selector: describe(el), detail: 'ends at ' + Math.round(r.right) + 'px' });
      }

      var minWidth = parseFloat(cs.minWidth);
      if (minWidth > vw + 1 && report.fixedWidth.length < MAX_ISSUES) {
        report.fixedWidth.push({ selector: describe(el), detail: 'min-width ' + Math.round(minWidth) + 'px' });
      }

      if (hasOwnText(el)) {
        if (parseFloat(cs.fontSize) < 10) report.smallText += 1;
        if (cs.overflowX === 'visible' && cs.display !== 'inline' && el.clientWidth > 0 &&
            el.scrollWidth > el.clientWidth + 1 && report.textOverflow.length < MAX_ISSUES) {
          report.textOverflow.push({ selector: describe(el), detail: 'text spills ' + (el.scrollWidth - el.clientWidth) + 'px' });
        }
      }
    }
    return report;
  }

  function loadState() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  var tracker = createNavTracker(loadState());
  var seq = 0;
  // Exposed for tests only.
  window.__marshellDevtools = { createNavTracker: createNavTracker };

  function report(kind) {
    tracker.record(kind, location.href);
    var snap = tracker.snapshot();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ stack: snap.stack, index: snap.index }));
    } catch (e) {
      // sessionStorage can be unavailable (privacy modes)
    }
    seq += 1;
    send('navigation', {
      seq: seq,
      url: location.href,
      title: document.title,
      canGoBack: snap.canGoBack,
      canGoForward: snap.canGoForward,
    });
  }

  var realPush = history.pushState;
  var realReplace = history.replaceState;
  history.pushState = function () {
    var result = realPush.apply(this, arguments);
    report('push');
    return result;
  };
  history.replaceState = function () {
    var result = realReplace.apply(this, arguments);
    report('replace');
    return result;
  };
  window.addEventListener('popstate', function () { report('pop'); });
  window.addEventListener('hashchange', function () { report('pop'); });

  report('load');
  window.addEventListener('load', function () { report('load'); });

  // Title changes (SPAs set it after load).
  function watchTitle() {
    var titleEl = document.querySelector('title');
    if (!titleEl || !window.MutationObserver) return;
    new MutationObserver(function () { report('replace'); }).observe(titleEl, {
      childList: true, characterData: true, subtree: true,
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchTitle);
  } else {
    watchTitle();
  }

  // --- Eruda (mobile devtools), loaded on demand from the proxy ----------------------
  var erudaState = 'idle'; // idle | loading | ready | failed
  var pendingShow = false;

  function closeEruda() {
    if (window.eruda) window.eruda.hide();
    send('eruda-closed', {});
  }

  // Adds a "DevTools" title and a close (X) button to the right of Eruda's header bar.
  function addCloseButton() {
    var tools = window.eruda._devTools;
    var panel = tools && tools._$el && tools._$el[0];
    var root = panel || window.eruda._shadowRoot || document;
    var bar = root.querySelector('[class*="nav-bar"]') || root.querySelector('[class*="luna-tab-tabs"]');
    if (!bar || bar.querySelector('.marshell-close')) return;
    var wrap = document.createElement('div');
    wrap.className = 'marshell-close';
    wrap.style.cssText = 'position:absolute;top:0;right:0;height:100%;display:flex;align-items:center;' +
      'padding:0 4px 0 12px;background:inherit;z-index:2;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Close DevTools');
    btn.title = 'Close DevTools';
    btn.textContent = '✕';
    btn.style.cssText = 'all:unset;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;' +
      'justify-content:center;border-radius:6px;font-size:16px;line-height:1;color:inherit;';
    btn.onmouseenter = function () { btn.style.background = 'rgba(255,255,255,0.15)'; };
    btn.onmouseleave = function () { btn.style.background = 'transparent'; };
    btn.onclick = closeEruda;
    wrap.appendChild(btn);
    if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
    bar.appendChild(wrap);
  }

  function withEruda(action) {
    if (erudaState === 'ready') return action(window.eruda);
    pendingShow = true;
    if (erudaState === 'loading') return;
    erudaState = 'loading';
    var script = document.createElement('script');
    script.src = '/__marshell/eruda.js';
    script.onload = function () {
      try {
        window.eruda.init({ defaults: { theme: 'Dark' } });
        var entry = window.eruda._entryBtn && window.eruda._entryBtn._$el && window.eruda._entryBtn._$el[0];
        if (entry) entry.style.display = 'none';
        erudaState = 'ready';
        try { addCloseButton(); } catch (e) { /* header stays usable via the toolbar toggle */ }
        setTimeout(function () { try { addCloseButton(); } catch (e) { /* ignore */ } }, 300);
        send('eruda-ready', {});
        if (pendingShow) action(window.eruda);
      } catch (e) {
        erudaState = 'failed';
      }
    };
    script.onerror = function () { erudaState = 'failed'; };
    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== COMMAND_SOURCE || event.source !== window.parent) return;
    switch (data.command) {
      case 'inspect-page':
        send('page-snapshot', {
          title: document.title.slice(0, 500),
          text: (document.body ? document.body.innerText : '').slice(0, 12000),
          headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 50).map(function (heading) {
            return heading.innerText.slice(0, 300);
          }),
          width: window.innerWidth,
          height: window.innerHeight,
        });
        break;
      case 'qa-audit':
        try { send('qa-report', audit()); } catch (e) { /* a broken page must not break the host */ }
        break;
      case 'back': history.back(); break;
      case 'forward': history.forward(); break;
      case 'reload': location.reload(); break;
      case 'toggle-eruda':
        withEruda(function (eruda) {
          var tools = eruda._devTools;
          if (tools && tools._isShow) { eruda.hide(); send('eruda-closed', {}); } else eruda.show();
        });
        break;
    }
  });
})();
