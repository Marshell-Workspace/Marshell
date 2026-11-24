//! File write commands for workspace edits.
//!
//! Rust never decides approval: the webview asks the user first and passes
//! `allow_outside_root` only once a path outside the workspace was approved. Every command
//! supports `dry_run`, which validates and previews without touching the disk.

use crate::fs_tools::{ensure_allowed, resolve_path, ResolvedPath};
use serde::Serialize;
use similar::TextDiff;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_EDIT_BYTES: u64 = 2 * 1024 * 1024;
const BINARY_SNIFF_BYTES: usize = 8 * 1024;
const CREATE_PREVIEW_LINES: usize = 40;
const REDACTION_MARKER: &str = "[REDACTED";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPathInfo {
    pub abs_path: String,
    pub exists: bool,
    pub inside_root: bool,
    pub is_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteOutcome {
    pub abs_path: String,
    /// False for dry runs.
    pub applied: bool,
    pub inside_root: bool,
    /// Unified diff for edits, the head of the content for new files, a summary otherwise.
    pub preview: String,
    /// Replacements made by an edit; 0 for every other operation.
    pub replacements: usize,
    pub to_path: Option<String>,
}

#[tauri::command]
pub fn fs_resolve_path(root: String, path: String) -> Result<ResolvedPathInfo, String> {
    let resolved = resolve_path(Path::new(&root), Path::new(&path))?;
    Ok(ResolvedPathInfo {
        abs_path: resolved.path.display().to_string(),
        exists: resolved.exists,
        inside_root: resolved.inside_root,
        is_dir: resolved.is_dir,
    })
}

#[tauri::command]
pub fn fs_create_file(
    root: String,
    path: String,
    content: String,
    allow_outside_root: bool,
    dry_run: bool,
) -> Result<WriteOutcome, String> {
    let resolved = resolve_path(Path::new(&root), Path::new(&path))?;
    check_access(&resolved, allow_outside_root, dry_run)?;
    if resolved.exists {
        return Err(format!(
            "'{}' already exists. Use fs_edit_file to change it.",
            resolved.path.display()
        ));
    }

    if !dry_run {
        create_parent_dirs(&resolved.path)?;
        write_atomic(&resolved.path, content.as_bytes())?;
    }

    Ok(outcome(
        &resolved.path,
        !dry_run,
        resolved.inside_root,
        content_preview(&content),
        0,
        None,
    ))
}

#[tauri::command]
pub fn fs_create_dir(
    root: String,
    path: String,
    allow_outside_root: bool,
    dry_run: bool,
) -> Result<WriteOutcome, String> {
    let resolved = resolve_path(Path::new(&root), Path::new(&path))?;
    check_access(&resolved, allow_outside_root, dry_run)?;
    if resolved.exists {
        return Err(format!("'{}' already exists.", resolved.path.display()));
    }

    if !dry_run {
        fs::create_dir_all(&resolved.path).map_err(|e| {
            format!(
                "Failed to create folder '{}': {}",
                resolved.path.display(),
                e
            )
        })?;
    }

    Ok(outcome(
        &resolved.path,
        !dry_run,
        resolved.inside_root,
        format!("Create folder {}", resolved.path.display()),
        0,
        None,
    ))
}

#[tauri::command]
pub fn fs_edit_file(
    root: String,
    path: String,
    old_text: String,
    new_text: String,
    replace_all: bool,
    allow_outside_root: bool,
    dry_run: bool,
) -> Result<WriteOutcome, String> {
    let resolved = resolve_path(Path::new(&root), Path::new(&path))?;
    check_access(&resolved, allow_outside_root, dry_run)?;
    if !resolved.exists {
        return Err(format!(
            "'{}' does not exist. Use fs_create_file to create it.",
            resolved.path.display()
        ));
    }
    if resolved.is_dir {
        return Err(format!("'{}' is a folder.", resolved.path.display()));
    }

    let original = read_editable_text(&resolved.target)?;
    let (updated, replacements) = apply_edit(&original, &old_text, &new_text, replace_all)?;
    let diff = unified_diff(&original, &updated, &resolved.path);

    if !dry_run {
        write_atomic(&resolved.target, updated.as_bytes())?;
    }

    Ok(outcome(
        &resolved.path,
        !dry_run,
        resolved.inside_root,
        diff,
        replacements,
        None,
    ))
}

#[tauri::command]
pub fn fs_move(
    root: String,
    from: String,
    to: String,
    allow_outside_root: bool,
    dry_run: bool,
) -> Result<WriteOutcome, String> {
    let root_path = Path::new(&root);
    let source = resolve_path(root_path, Path::new(&from))?;
    let destination = resolve_path(root_path, Path::new(&to))?;
    check_access(&source, allow_outside_root, dry_run)?;
    check_access(&destination, allow_outside_root, dry_run)?;

    if !source.exists {
        return Err(format!("'{}' does not exist.", source.path.display()));
    }
    ensure_not_protected(&source, root_path, home_dir().as_deref())?;
    if destination.exists {
        return Err(format!(
            "'{}' already exists. Choose another destination.",
            destination.path.display()
        ));
    }
    if destination.path.starts_with(&source.path) {
        return Err(format!(
            "Cannot move '{}' into itself.",
            source.path.display()
        ));
    }

    if !dry_run {
        create_parent_dirs(&destination.path)?;
        fs::rename(&source.path, &destination.path).map_err(|e| {
            format!(
                "Failed to move '{}' to '{}': {}",
                source.path.display(),
                destination.path.display(),
                e
            )
        })?;
    }

    Ok(outcome(
        &source.path,
        !dry_run,
        source.inside_root && destination.inside_root,
        format!(
            "Move {} → {}",
            source.path.display(),
            destination.path.display()
        ),
        0,
        Some(&destination.path),
    ))
}

#[tauri::command]
pub fn fs_delete(
    root: String,
    path: String,
    allow_outside_root: bool,
    dry_run: bool,
) -> Result<WriteOutcome, String> {
    let root_path = Path::new(&root);
    let resolved = resolve_path(root_path, Path::new(&path))?;
    check_access(&resolved, allow_outside_root, dry_run)?;
    if !resolved.exists {
        return Err(format!("'{}' does not exist.", resolved.path.display()));
    }
    ensure_not_protected(&resolved, root_path, home_dir().as_deref())?;

    let is_folder = fs::symlink_metadata(&resolved.path)
        .map(|m| m.is_dir())
        .unwrap_or(false);
    let preview = format!(
        "Move {} {} to Trash",
        if is_folder { "folder" } else { "file" },
        resolved.path.display()
    );

    if !dry_run {
        move_to_trash(&resolved.path)?;
    }

    Ok(outcome(
        &resolved.path,
        !dry_run,
        resolved.inside_root,
        preview,
        0,
        None,
    ))
}

/// Dry runs only preview, so they may look outside the root before the user approves.
fn check_access(resolved: &ResolvedPath, allow_outside_root: bool, dry_run: bool) -> Result<(), String> {
    if dry_run {
        Ok(())
    } else {
        ensure_allowed(resolved, allow_outside_root)
    }
}

/// Refuses to delete or move the filesystem root, the home directory itself, or the
/// workspace root itself, even when the user approved it.
fn ensure_not_protected(resolved: &ResolvedPath, root: &Path, home: Option<&Path>) -> Result<(), String> {
    let canonical_home = home.and_then(|h| h.canonicalize().ok());
    let canonical_root = root.canonicalize().ok();

    for candidate in [&resolved.path, &resolved.target] {
        let is_filesystem_root = candidate.parent().is_none();
        let is_home = canonical_home.as_deref() == Some(candidate.as_path());
        let is_workspace_root = canonical_root.as_deref() == Some(candidate.as_path());
        if is_filesystem_root || is_home || is_workspace_root {
            return Err(format!(
                "Refusing to delete or move '{}': it is a protected path.",
                resolved.path.display()
            ));
        }
    }
    Ok(())
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn move_to_trash(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|e| {
        format!(
            "Could not move '{}' to Trash, so it was not deleted: {}",
            path.display(),
            e
        )
    })
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn move_to_trash(path: &Path) -> Result<(), String> {
    Err(format!(
        "Deleting '{}' is unavailable on this platform because there is no Trash.",
        path.display()
    ))
}

/// Applies an exact find-and-replace. Returns the new content and the number of replacements.
pub fn apply_edit(
    content: &str,
    old_text: &str,
    new_text: &str,
    replace_all: bool,
) -> Result<(String, usize), String> {
    if old_text.is_empty() {
        return Err("oldText must not be empty.".to_string());
    }
    if old_text.contains(REDACTION_MARKER) {
        return Err(
            "oldText contains redacted content; secret values cannot be edited with this tool."
                .to_string(),
        );
    }
    if old_text == new_text {
        return Err("oldText and newText are identical, so there is nothing to change.".to_string());
    }

    let exact_matches = content.matches(old_text).count();
    if exact_matches > 0 {
        return replace_matches(content, old_text, new_text, replace_all, exact_matches);
    }

    // CRLF files: the model usually sends LF text. Match on LF, then restore CRLF endings.
    if content.contains("\r\n") {
        let content_lf = content.replace("\r\n", "\n");
        let old_lf = old_text.replace("\r\n", "\n");
        let new_lf = new_text.replace("\r\n", "\n");
        let lf_matches = content_lf.matches(old_lf.as_str()).count();
        if lf_matches > 0 {
            let (updated, replacements) =
                replace_matches(&content_lf, &old_lf, &new_lf, replace_all, lf_matches)?;
            return Ok((updated.replace('\n', "\r\n"), replacements));
        }
    }

    Err(
        "oldText was not found. Re-read the file and copy the text exactly, including whitespace."
            .to_string(),
    )
}

fn replace_matches(
    content: &str,
    old_text: &str,
    new_text: &str,
    replace_all: bool,
    matches: usize,
) -> Result<(String, usize), String> {
    if replace_all {
        return Ok((content.replace(old_text, new_text), matches));
    }
    if matches > 1 {
        return Err(format!(
            "oldText matches {} places. Include more surrounding lines to make it unique, or set replaceAll to change every match.",
            matches
        ));
    }
    Ok((content.replacen(old_text, new_text, 1), 1))
}

fn read_editable_text(path: &Path) -> Result<String, String> {
    let size = fs::metadata(path)
        .map_err(|e| crate::fs_tools::filesystem_error("read file", path, &e))?
        .len();
    if size > MAX_EDIT_BYTES {
        return Err(format!(
            "'{}' is {} bytes; files over 2 MB cannot be edited.",
            path.display(),
            size
        ));
    }

    let bytes = fs::read(path).map_err(|e| crate::fs_tools::filesystem_error("read file", path, &e))?;
    if bytes.iter().take(BINARY_SNIFF_BYTES).any(|byte| *byte == 0) {
        return Err(format!(
            "'{}' looks like a binary file and cannot be edited as text.",
            path.display()
        ));
    }
    String::from_utf8(bytes).map_err(|_| format!("'{}' is not valid UTF-8 text.", path.display()))
}

fn unified_diff(before: &str, after: &str, path: &Path) -> String {
    let name = path.display().to_string();
    TextDiff::from_lines(before, after)
        .unified_diff()
        .context_radius(3)
        .header(&name, &name)
        .to_string()
}

fn content_preview(content: &str) -> String {
    let total_lines = content.lines().count();
    let mut preview = content
        .lines()
        .take(CREATE_PREVIEW_LINES)
        .collect::<Vec<_>>()
        .join("\n");
    if total_lines > CREATE_PREVIEW_LINES {
        preview.push_str(&format!(
            "\n… ({} more lines)",
            total_lines - CREATE_PREVIEW_LINES
        ));
    }
    preview
}

fn create_parent_dirs(path: &Path) -> Result<(), String> {
    match path.parent() {
        Some(parent) => fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create folder '{}': {}", parent.display(), e)),
        None => Ok(()),
    }
}

/// Writes to a temporary sibling and renames it into place, so a crash never leaves a
/// half-written file. Keeps the permissions of the file being replaced.
fn write_atomic(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("'{}' has no parent folder.", path.display()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("'{}' has no file name.", path.display()))?;
    let temp_path = parent.join(format!(
        ".{}.{}.tmp",
        file_name.to_string_lossy(),
        uuid::Uuid::new_v4()
    ));
    let permissions = fs::metadata(path).ok().map(|m| m.permissions());

    let written = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp_path)?;
        file.write_all(contents)?;
        file.sync_all()?;
        if let Some(permissions) = permissions {
            fs::set_permissions(&temp_path, permissions)?;
        }
        fs::rename(&temp_path, path)
    })();

    written.map_err(|e| {
        let _ = fs::remove_file(&temp_path);
        format!("Failed to write '{}': {}", path.display(), e)
    })
}

fn outcome(
    path: &Path,
    applied: bool,
    inside_root: bool,
    preview: String,
    replacements: usize,
    to_path: Option<&Path>,
) -> WriteOutcome {
    WriteOutcome {
        abs_path: path.display().to_string(),
        applied,
        inside_root,
        preview,
        replacements,
        to_path: to_path.map(|p| p.display().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::{tempdir, TempDir};

    fn arg(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }

    fn root_arg(dir: &TempDir) -> String {
        arg(dir.path())
    }

    #[test]
    fn create_writes_new_files_and_their_parent_folders() {
        let root = tempdir().unwrap();

        let result = fs_create_file(root_arg(&root), "src/lib/new.ts".into(), "export {};\n".into(), false, false).unwrap();

        assert!(result.applied);
        assert!(result.inside_root);
        assert_eq!(
            fs::read_to_string(root.path().join("src/lib/new.ts")).unwrap(),
            "export {};\n"
        );
    }

    #[test]
    fn create_refuses_existing_files() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("a.txt"), "keep").unwrap();

        let error = fs_create_file(root_arg(&root), "a.txt".into(), "new".into(), false, false).unwrap_err();

        assert!(error.contains("already exists"));
        assert_eq!(fs::read_to_string(root.path().join("a.txt")).unwrap(), "keep");
    }

    #[test]
    fn create_dir_makes_nested_folders() {
        let root = tempdir().unwrap();

        fs_create_dir(root_arg(&root), "a/b/c".into(), false, false).unwrap();

        assert!(root.path().join("a/b/c").is_dir());
    }

    #[test]
    fn dry_runs_never_touch_the_disk() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("a.txt"), "hello world\n").unwrap();

        let create = fs_create_file(root_arg(&root), "b.txt".into(), "x".into(), false, true).unwrap();
        let folder = fs_create_dir(root_arg(&root), "dir".into(), false, true).unwrap();
        let edit = fs_edit_file(root_arg(&root), "a.txt".into(), "world".into(), "there".into(), false, false, true).unwrap();
        let moved = fs_move(root_arg(&root), "a.txt".into(), "c.txt".into(), false, true).unwrap();
        let deleted = fs_delete(root_arg(&root), "a.txt".into(), false, true).unwrap();

        for result in [&create, &folder, &edit, &moved, &deleted] {
            assert!(!result.applied);
        }
        assert!(edit.preview.contains("+hello there"));
        assert!(!root.path().join("b.txt").exists());
        assert!(!root.path().join("dir").exists());
        assert!(!root.path().join("c.txt").exists());
        assert_eq!(fs::read_to_string(root.path().join("a.txt")).unwrap(), "hello world\n");
    }

    #[test]
    fn edit_replaces_a_unique_match_and_returns_a_diff() {
        let root = tempdir().unwrap();
        let file = root.path().join("main.rs");
        fs::write(&file, "fn main() {\n    println!(\"hi\");\n}\n").unwrap();

        let result = fs_edit_file(root_arg(&root), "main.rs".into(), "println!(\"hi\")".into(), "println!(\"bye\")".into(), false, false, false).unwrap();

        assert_eq!(result.replacements, 1);
        assert!(result.preview.contains("-    println!(\"hi\");"));
        assert!(result.preview.contains("+    println!(\"bye\");"));
        assert_eq!(
            fs::read_to_string(&file).unwrap(),
            "fn main() {\n    println!(\"bye\");\n}\n"
        );
    }

    #[test]
    fn edit_rejects_missing_and_ambiguous_matches() {
        let missing = apply_edit("a b a", "c", "d", false).unwrap_err();
        let ambiguous = apply_edit("a b a", "a", "d", false).unwrap_err();

        assert!(missing.contains("not found"));
        assert!(ambiguous.contains("matches 2 places"));
    }

    #[test]
    fn edit_replace_all_changes_every_match() {
        assert_eq!(
            apply_edit("a b a", "a", "d", true).unwrap(),
            ("d b d".to_string(), 2)
        );
    }

    #[test]
    fn edit_keeps_crlf_line_endings() {
        assert_eq!(
            apply_edit("a\r\nb\r\nc\r\n", "b\nc", "B\nC", false).unwrap(),
            ("a\r\nB\r\nC\r\n".to_string(), 1)
        );
    }

    #[test]
    fn edit_refuses_redacted_text() {
        let error = apply_edit("API_KEY= [REDACTED]\n", "API_KEY= [REDACTED]", "API_KEY=x", false).unwrap_err();

        assert!(error.contains("redacted"));
    }

    #[test]
    fn edit_refuses_binary_and_oversized_files() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("image.bin"), [0u8, 1, 2, 3]).unwrap();
        fs::write(
            root.path().join("huge.txt"),
            vec![b'a'; (MAX_EDIT_BYTES + 1) as usize],
        )
        .unwrap();

        let binary = fs_edit_file(root_arg(&root), "image.bin".into(), "a".into(), "b".into(), false, false, false).unwrap_err();
        let huge = fs_edit_file(root_arg(&root), "huge.txt".into(), "a".into(), "b".into(), true, false, false).unwrap_err();

        assert!(binary.contains("binary"));
        assert!(huge.contains("over 2 MB"));
    }

    #[test]
    fn move_renames_and_refuses_existing_destinations() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("a.txt"), "a").unwrap();
        fs::write(root.path().join("taken.txt"), "t").unwrap();

        let refused = fs_move(root_arg(&root), "a.txt".into(), "taken.txt".into(), false, false).unwrap_err();
        let moved = fs_move(root_arg(&root), "a.txt".into(), "docs/b.txt".into(), false, false).unwrap();

        assert!(refused.contains("already exists"));
        assert!(moved.applied);
        assert!(!root.path().join("a.txt").exists());
        assert_eq!(fs::read_to_string(root.path().join("docs/b.txt")).unwrap(), "a");
    }

    #[test]
    fn writes_outside_the_root_need_permission() {
        let root = tempdir().unwrap();
        let other = tempdir().unwrap();
        let outside = arg(&other.path().join("outside.txt"));

        let denied = fs_create_file(root_arg(&root), outside.clone(), "x".into(), false, false).unwrap_err();
        let allowed = fs_create_file(root_arg(&root), outside, "x".into(), true, false).unwrap();

        assert!(denied.contains("outside the workspace root"));
        assert!(allowed.applied);
        assert!(!allowed.inside_root);
    }

    #[test]
    fn protected_paths_are_refused_even_with_permission() {
        let root = tempdir().unwrap();
        let home = tempdir().unwrap();

        let workspace_root = fs_delete(root_arg(&root), ".".into(), true, false).unwrap_err();
        let workspace_move = fs_move(root_arg(&root), ".".into(), "elsewhere".into(), true, true).unwrap_err();
        let home_dir = resolve_path(root.path(), home.path()).unwrap();
        let filesystem_root = resolve_path(root.path(), Path::new("/")).unwrap();

        assert!(workspace_root.contains("protected path"));
        assert!(workspace_move.contains("protected path"));
        assert!(ensure_not_protected(&home_dir, root.path(), Some(home.path())).is_err());
        assert!(ensure_not_protected(&filesystem_root, root.path(), None).is_err());
        assert!(root.path().exists());
    }

    #[test]
    #[ignore = "needs a desktop Trash"]
    fn delete_moves_files_to_trash() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("gone.txt"), "bye").unwrap();

        let result = fs_delete(root_arg(&root), "gone.txt".into(), false, false).unwrap();

        assert!(result.applied);
        assert!(!root.path().join("gone.txt").exists());
    }
}
