# Third-party notices for `public/scripts`

These scripts are injected into pages shown in Marshell's in-app preview (see
`src-tauri/src/preview_proxy.rs`).

- `bippy_bundle.js`, `click_to_component_script.js` — adapted from
  [vibe-kanban](https://github.com/BloopAI/vibe-kanban) (`crates/preview-proxy`),
  Apache License 2.0. Changes: globals renamed (`VKBippy` -> `MarshellBippy`), message
  channel renamed to `marshell-inspector`, and Alt/Option+click inspection added.
  `bippy_bundle.js` bundles [bippy](https://github.com/aidenybai/bippy) (MIT).
- `eruda.js` — [Eruda](https://github.com/liriliri/eruda) 3.4.3 (MIT), vendored so the
  preview works offline.
- `devtools_script.js` — original to Marshell.
