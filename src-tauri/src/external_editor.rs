//! Launches a path (optionally at a line) in an external editor. Only allowlisted editor
//! binaries are runnable.

use std::path::Path;
use std::process::{Command, Stdio};

const ALLOWED_EDITORS: [&str; 4] = ["code", "cursor", "zed", "subl"];

/// Editor arguments for a path, jumping to `line` where the editor supports it.
pub fn editor_args(editor: &str, path: &str, line: Option<u32>) -> Vec<String> {
    match (editor, line) {
        ("code" | "cursor", Some(l)) => vec!["-g".into(), format!("{path}:{l}")],
        ("zed" | "subl", Some(l)) => vec![format!("{path}:{l}")],
        _ => vec![path.to_string()],
    }
}

#[tauri::command]
pub fn open_in_external_editor(path: String, editor: String, line: Option<u32>) -> Result<(), String> {
    if !ALLOWED_EDITORS.contains(&editor.as_str()) {
        return Err(format!("Unsupported editor: {editor}"));
    }
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // Windows ships these as `.cmd` shims, which only `cmd /C` can resolve.
    #[cfg(windows)]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", &editor]);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = Command::new(&editor);

    cmd.args(editor_args(&editor, &path, line))
        // Editor CLIs live in Homebrew or user bins, not in the minimal PATH
        // of a Finder-launched app; resolve the merged login PATH first.
        .env("PATH", crate::build_merged_path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Could not launch {editor} (is it on your PATH?): {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_editors_and_missing_paths() {
        assert!(open_in_external_editor("/tmp".into(), "rm".into(), None).is_err());
        assert!(open_in_external_editor("/definitely/missing".into(), "code".into(), None).is_err());
    }

    #[test]
    fn jumps_to_the_line_in_each_editor() {
        assert_eq!(editor_args("code", "/a/b.ts", Some(42)), ["-g", "/a/b.ts:42"]);
        assert_eq!(editor_args("cursor", "/a/b.ts", Some(1)), ["-g", "/a/b.ts:1"]);
        assert_eq!(editor_args("zed", "/a/b.ts", Some(7)), ["/a/b.ts:7"]);
        assert_eq!(editor_args("subl", "/a/b.ts", None), ["/a/b.ts"]);
    }
}
