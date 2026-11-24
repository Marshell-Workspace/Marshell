use serde::Serialize;
use std::fs;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrepMatch {
    pub path: String,
    pub line_number: usize,
    pub line: String,
}

/// Keep operating-system denials distinct from user approval prompts.
pub(crate) fn filesystem_error(action: &str, path: &Path, error: &std::io::Error) -> String {
    let detail = format!("Failed to {action} '{}': {error}", path.display());
    if cfg!(target_os = "macos") && (error.kind() == std::io::ErrorKind::PermissionDenied || error.raw_os_error() == Some(1)) {
        format!("{detail}. macOS blocked access to this folder. Check Marshell in System Settings > Privacy & Security > Files and Folders, or select an accessible workspace.")
    } else { detail }
}

/// A user-supplied path resolved against the workspace root.
#[derive(Debug, Clone)]
pub struct ResolvedPath {
    /// Canonical parent joined with the final component, so a symlink names itself.
    pub path: PathBuf,
    /// Where `path` finally points with symlinks followed; equals `path` when it doesn't exist.
    pub target: PathBuf,
    /// Both `path` and `target` sit inside the canonical workspace root.
    pub inside_root: bool,
    pub exists: bool,
    pub is_dir: bool,
}

/// Explicit error indicating that path access outside the designated workspace root is forbidden.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PermissionDeniedError(pub String);

impl std::fmt::Display for PermissionDeniedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "PermissionDeniedError: {}", self.0)
    }
}

impl std::error::Error for PermissionDeniedError {}

/// Validates and resolves a user/agent target path against the explicit workspace root.
///
/// Requirements enforced:
/// 1. Canonicalizes both paths to absolute paths.
/// 2. Confirms canonical_target_path starts with canonical_workspace_root.
/// 3. Rejects access outside the designated directory with an explicit PermissionDeniedError.
/// 4. Handles symlinks securely (prevents escaping via symlink redirection).
pub fn validate_and_resolve_path<P1: AsRef<Path>, P2: AsRef<Path>>(
    user_target_path: P1,
    workspace_root: P2,
) -> Result<PathBuf, PermissionDeniedError> {
    let user_target_path = user_target_path.as_ref();
    let workspace_root = workspace_root.as_ref();

    // 1. Canonicalize workspace_root to an absolute canonical path
    let canonical_workspace_root = workspace_root.canonicalize().map_err(|e| {
        PermissionDeniedError(filesystem_error("resolve workspace root", workspace_root, &e))
    })?;

    if !canonical_workspace_root.is_dir() {
        return Err(PermissionDeniedError(format!(
            "Workspace root '{}' is not a directory",
            workspace_root.display()
        )));
    }

    // 2. Reject raw null bytes
    let path_str = user_target_path.to_string_lossy();
    if path_str.contains('\0') {
        return Err(PermissionDeniedError(
            "Path contains forbidden null bytes".to_string(),
        ));
    }

    // 3. Security checks for Windows Alternate Data Streams & DOS device names
    for component in user_target_path.components() {
        match component {
            Component::Prefix(_) => {}
            Component::Normal(_os_str) => {
                #[cfg(windows)]
                let s = _os_str.to_string_lossy();
                #[cfg(windows)]
                if s.contains(':') {
                    return Err(PermissionDeniedError(format!(
                        "Path contains forbidden NTFS stream marker or colon in component '{}'",
                        s
                    )));
                }
                #[cfg(windows)]
                {
                    const DOS_DEVICES: &[&str] = &[
                        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5",
                        "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5",
                        "LPT6", "LPT7", "LPT8", "LPT9",
                    ];
                    let stem = Path::new(_os_str)
                        .file_stem()
                        .and_then(|st| st.to_str())
                        .unwrap_or("");
                    if DOS_DEVICES.iter().any(|&dev| dev.eq_ignore_ascii_case(stem)) {
                        return Err(PermissionDeniedError(format!(
                            "Path component '{}' references a reserved DOS device name",
                            s
                        )));
                    }
                }
            }
            _ => {}
        }
    }

    // 4. Anchor user_target_path: relative paths join canonical_workspace_root
    let target_to_resolve = if user_target_path.as_os_str().is_empty()
        || user_target_path == Path::new(".")
    {
        canonical_workspace_root.clone()
    } else if user_target_path.is_absolute() {
        user_target_path.to_path_buf()
    } else {
        canonical_workspace_root.join(user_target_path)
    };

    // 5. Canonicalize target path (resolves .. and all symlinks to absolute physical paths)
    let canonical_target_path = if target_to_resolve.exists()
        || fs::symlink_metadata(&target_to_resolve).is_ok()
    {
        target_to_resolve.canonicalize().map_err(|e| {
            PermissionDeniedError(format!(
                "Failed to canonicalize path '{}': {}",
                target_to_resolve.display(),
                e
            ))
        })?
    } else {
        // Path does not exist yet (e.g. creating a new file or directory)
        let mut existing = target_to_resolve.as_path();
        let mut missing_components = Vec::new();
        let canonical_ancestor = loop {
            if let Ok(c) = existing.canonicalize() {
                break c;
            }
            match (existing.parent(), existing.file_name()) {
                (Some(parent), Some(name)) => {
                    missing_components.push(name);
                    existing = parent;
                }
                _ => {
                    return Err(PermissionDeniedError(format!(
                        "Cannot resolve path '{}': no valid existing ancestor",
                        target_to_resolve.display()
                    )));
                }
            }
        };

        // Ancestor must reside within workspace root
        if !canonical_ancestor.starts_with(&canonical_workspace_root) {
            return Err(PermissionDeniedError(format!(
                "Access outside workspace root is denied: ancestor '{}' of '{}' is outside '{}'",
                canonical_ancestor.display(),
                user_target_path.display(),
                canonical_workspace_root.display()
            )));
        }

        let mut resolved = canonical_ancestor;
        for name in missing_components.into_iter().rev() {
            let s = name.to_string_lossy();
            if s == ".." || s == "." || s.contains('/') || s.contains('\\') || s.contains('\0') {
                return Err(PermissionDeniedError(format!(
                    "Path contains invalid component '{}'",
                    s
                )));
            }
            resolved.push(name);
        }
        resolved
    };

    // 6. Confirms canonical_target_path starts with canonical_workspace_root
    if !canonical_target_path.starts_with(&canonical_workspace_root) {
        return Err(PermissionDeniedError(format!(
            "Access outside workspace root is denied: target '{}' (resolved to '{}') is outside '{}'",
            user_target_path.display(),
            canonical_target_path.display(),
            canonical_workspace_root.display()
        )));
    }

    Ok(canonical_target_path)
}

/// Resolves `input` (relative to `root`, or absolute) without trusting `..` or symlinks.
///
/// `..` is collapsed lexically first, then the deepest existing ancestor is canonicalized,
/// so neither a path through a missing folder nor a symlink can leave the root unnoticed.
pub fn resolve_path(root: &Path, input: &Path) -> Result<ResolvedPath, String> {
    let canonical_root = root.canonicalize().map_err(|e| {
        filesystem_error("resolve workspace root", root, &e)
    })?;
    let joined = if input.is_absolute() {
        input.to_path_buf()
    } else {
        canonical_root.join(input)
    };
    let normalized = normalize_lexically(&joined);

    let path = match (normalized.parent(), normalized.file_name()) {
        (Some(parent), Some(name)) => canonicalize_existing_prefix(parent)?.join(name),
        _ => canonicalize_existing_prefix(&normalized)?,
    };
    let exists = fs::symlink_metadata(&path).is_ok();
    let target = if exists {
        path.canonicalize().unwrap_or_else(|_| path.clone())
    } else {
        path.clone()
    };
    let is_dir = exists && target.is_dir();
    let inside_root = path.starts_with(&canonical_root) && target.starts_with(&canonical_root);

    Ok(ResolvedPath {
        path,
        target,
        inside_root,
        exists,
        is_dir,
    })
}

/// Rejects a path outside the workspace root unless the caller was allowed to reach it.
pub fn ensure_allowed(resolved: &ResolvedPath, allow_outside_root: bool) -> Result<(), String> {
    if resolved.inside_root || allow_outside_root {
        Ok(())
    } else {
        Err(format!(
            "'{}' is outside the workspace root. Accessing it needs the user's approval.",
            resolved.path.display()
        ))
    }
}

fn normalize_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

/// Canonicalizes the deepest ancestor that exists and re-appends the missing components.
fn canonicalize_existing_prefix(path: &Path) -> Result<PathBuf, String> {
    let mut existing = path;
    let mut missing = Vec::new();
    loop {
        match existing.canonicalize() {
            Ok(mut resolved) => {
                for name in missing.iter().rev() { resolved.push(name); }
                return Ok(resolved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(filesystem_error("resolve path", existing, &error)),
        }
        let unresolvable = || format!("Cannot resolve path '{}'", path.display());
        missing.push(existing.file_name().ok_or_else(unresolvable)?);
        existing = existing.parent().ok_or_else(unresolvable)?;
    }
}

/// Secret redactor to prevent leaking sensitive credentials into LLM transcripts
pub(crate) fn redact_secrets(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut in_private_key_block = false;

    for line in input.lines() {
        let trimmed = line.trim();

        if trimmed.contains("BEGIN ") && (trimmed.contains("PRIVATE KEY") || trimmed.contains("CERTIFICATE") || trimmed.contains("RSA")) {
            in_private_key_block = true;
            output.push_str("[REDACTED KEY BLOCK]\n");
            continue;
        }

        if in_private_key_block {
            if trimmed.contains("END ") && (trimmed.contains("PRIVATE KEY") || trimmed.contains("CERTIFICATE") || trimmed.contains("RSA")) {
                in_private_key_block = false;
            }
            continue;
        }

        let lower = trimmed.to_ascii_lowercase();
        let is_secret_var = !trimmed.starts_with('#')
            && !trimmed.starts_with("//")
            && (lower.contains("key")
                || lower.contains("secret")
                || lower.contains("token")
                || lower.contains("password")
                || lower.contains("passwd")
                || lower.contains("credential")
                || lower.contains("auth"));

        if is_secret_var {
            if let Some(pos) = line.find('=').or_else(|| line.find(':')) {
                if !line[..pos].ends_with("http") && !line[..pos].ends_with("https") {
                    output.push_str(&line[..=pos]);
                    output.push_str(" [REDACTED]\n");
                    continue;
                }
            }
        }

        if lower.contains("bearer ") {
            if let Some(pos) = lower.find("bearer ") {
                let split_pos = pos + 7;
                output.push_str(&line[..split_pos]);
                output.push_str("[REDACTED]\n");
                continue;
            }
        }

        output.push_str(line);
        output.push('\n');
    }
    output
}

#[tauri::command]
pub fn list_dir(
    root: String,
    path: String,
    _allow_outside_root: Option<bool>,
) -> Result<Vec<DirEntry>, String> {
    let target_dir = validate_and_resolve_path(Path::new(&path), Path::new(&root))
        .map_err(|e| e.to_string())?;

    if !target_dir.is_dir() {
        return Err(format!("'{}' is not a directory", target_dir.display()));
    }

    let entries = fs::read_dir(&target_dir)
        .map_err(|e| filesystem_error("read directory", &target_dir, &e))?;

    let mut result = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        // Skip common noisy directories
        if file_name == ".git" || file_name == "node_modules" || file_name == ".turbo" {
            continue;
        }

        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
        let size = if is_dir {
            0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };

        result.push(DirEntry {
            name: file_name,
            is_dir,
            size,
        });
    }

    // Sort directories first, then alphabetically
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

#[tauri::command]
pub fn read_text_file(
    root: String,
    path: String,
    max_bytes: Option<usize>,
    _allow_outside_root: Option<bool>,
    offset_bytes: Option<u64>,
) -> Result<String, String> {
    let target_file = validate_and_resolve_path(Path::new(&path), Path::new(&root))
        .map_err(|e| e.to_string())?;

    if !target_file.is_file() {
        return Err(format!("'{}' is not a regular file", target_file.display()));
    }

    let limit = max_bytes.unwrap_or(64 * 1024); // 64KB default
    if limit == 0 {
        return Err("maxBytes must be greater than zero".into());
    }
    let mut file = fs::File::open(&target_file)
        .map_err(|e| filesystem_error("open file", &target_file, &e))?;
    let total = file.metadata().map_err(|e| filesystem_error("inspect file", &target_file, &e))?.len();
    let offset = offset_bytes.unwrap_or(0).min(total);
    file.seek(SeekFrom::Start(offset)).map_err(|e| filesystem_error("seek file", &target_file, &e))?;

    let mut reader = file.take(limit as u64);
    let mut buffer = Vec::new();
    reader
        .read_to_end(&mut buffer)
        .map_err(|e| filesystem_error("read file", &target_file, &e))?;

    // A returned nextOffset must not land inside a valid UTF-8 character.
    if let Err(error) = std::str::from_utf8(&buffer) {
        if error.error_len().is_none() {
            buffer.truncate(error.valid_up_to());
        }
    }
    if buffer.is_empty() && offset < total {
        return Err("maxBytes is too small to read the next UTF-8 character; increase it to at least 4".into());
    }
    let next = offset + buffer.len() as u64;

    let raw_text = String::from_utf8_lossy(&buffer).to_string();
    let mut sanitized = redact_secrets(&raw_text);
    if !raw_text.ends_with('\n') && sanitized.ends_with('\n') {
        sanitized.pop();
    }

    if offset > 0 || next < total {
        Ok(format!("[File byte range {offset}..{next} of {total}; nextOffset={next}; more={}. Continue with offsetBytes={next} and maxBytes for an exact range.]\n{sanitized}", next < total))
    } else {
        Ok(sanitized)
    }
}

#[tauri::command]
pub fn grep_repo(
    root: String,
    pattern: String,
    glob: Option<String>,
    path: Option<String>,
    _allow_outside_root: Option<bool>,
) -> Result<Vec<GrepMatch>, String> {
    let root_path = Path::new(&root);
    let canonical_root = validate_and_resolve_path(Path::new("."), root_path)
        .map_err(|e| e.to_string())?;

    if pattern.trim().is_empty() {
        return Ok(Vec::new());
    }

    let search_dir = match path.as_deref().map(str::trim) {
        Some(sub_path) if !sub_path.is_empty() => {
            let validated = validate_and_resolve_path(Path::new(sub_path), root_path)
                .map_err(|e| e.to_string())?;
            if !validated.is_dir() {
                return Err(format!("'{}' is not a directory", validated.display()));
            }
            validated
        }
        _ => canonical_root.clone(),
    };

    // 1. Try invoking `rg` (ripgrep) if installed
    let mut rg_cmd = Command::new("rg");
    // ripgrep is not a system binary on macOS (Homebrew/cargo only); the
    // minimal Finder-launched PATH never resolves it without the merged login PATH.
    rg_cmd.env("PATH", crate::build_merged_path());
    rg_cmd
        .arg("--line-number")
        .arg("--no-heading")
        .arg("--color=never")
        .arg("--max-count=50")
        .arg("--max-filesize=1M")
        .arg("-g")
        .arg("!.git")
        .arg("-g")
        .arg("!node_modules");

    if let Some(ref g) = glob {
        if !g.trim().is_empty() {
            rg_cmd.arg("-g").arg(g);
        }
    }

    rg_cmd.arg("--").arg(&pattern).arg(&search_dir);

    if let Ok(output) = rg_cmd.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut matches = Vec::new();

            for line in stdout.lines().take(60) {
                let parts: Vec<&str> = line.splitn(3, ':').collect();
                if parts.len() >= 3 {
                    let file_path = parts[0];
                    let line_num: usize = parts[1].parse().unwrap_or(1);
                    let line_content = parts[2].trim();

                    // Relative path from root
                    let rel_display = Path::new(file_path)
                        .strip_prefix(&canonical_root)
                        .unwrap_or(Path::new(file_path))
                        .to_string_lossy()
                        .to_string();

                    matches.push(GrepMatch {
                        path: rel_display,
                        line_number: line_num,
                        line: line_content.to_string(),
                    });
                }
            }
            return Ok(matches);
        }
    }

    // 2. Fallback: simple recursive directory scanner in Rust
    let mut matches = Vec::new();
    fn scan_dir(
        dir: &Path,
        root: &Path,
        pattern: &str,
        matches: &mut Vec<GrepMatch>,
    ) {
        if matches.len() >= 50 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                if matches.len() >= 50 {
                    break;
                }
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if file_name == ".git"
                    || file_name == "node_modules"
                    || file_name == "target"
                    || file_name == "dist"
                    || file_name == ".turbo"
                    || file_name == ".next"
                {
                    continue;
                }

                let validated_entry = match validate_and_resolve_path(&path, root) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                if validated_entry.is_dir() {
                    scan_dir(&validated_entry, root, pattern, matches);
                } else if validated_entry.is_file() {
                    if let Ok(meta) = validated_entry.metadata() {
                        if meta.len() > 512 * 1024 {
                            continue; // Skip files larger than 512KB in fallback
                        }
                    }
                    if let Ok(file) = fs::File::open(&validated_entry) {
                        let reader = BufReader::new(file);
                        for (idx, line_res) in reader.lines().enumerate() {
                            if matches.len() >= 50 {
                                break;
                            }
                            if let Ok(line) = line_res {
                                if line.to_lowercase().contains(&pattern.to_lowercase()) {
                                    let rel_display = validated_entry
                                        .strip_prefix(root)
                                        .unwrap_or(&validated_entry)
                                        .to_string_lossy()
                                        .to_string();

                                    matches.push(GrepMatch {
                                        path: rel_display,
                                        line_number: idx + 1,
                                        line: line.trim().to_string(),
                                    });

                                    if matches.len() >= 50 {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    scan_dir(&search_dir, &canonical_root, &pattern, &mut matches);
    Ok(matches)
}

pub fn normalize_windows_path(path_str: &str) -> String {
    let s = path_str.trim();
    if s == "THIS_PC" || s.is_empty() {
        return "THIS_PC".to_string();
    }

    #[cfg(target_os = "windows")]
    {
        let mut s = s.to_string();
        if s.starts_with(r"\\?\") {
            s = s[4..].to_string();
        }
        s = s.replace('/', "\\");
        if s.len() == 2 && s.ends_with(':') {
            s.push('\\');
        }
        if s.len() > 3 && s.ends_with('\\') {
            s.pop();
        }
        s
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut s = s.replace('\\', "/");
        if s.is_empty() {
            return "/".to_string();
        }
        while s.contains("//") {
            s = s.replace("//", "/");
        }
        if s.len() > 1 && s.ends_with('/') {
            s.pop();
        }
        s
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
    pub drive_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub name: String,
    pub full_path: String,
    pub item_type: String,
    pub is_dir: bool,
    pub is_drive: bool,
    pub hidden: bool,
    pub modified_time: Option<u64>,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub path: String,
    pub parent: Option<String>,
    pub items: Vec<FileItem>,
}

pub fn list_windows_drives_internal() -> Vec<DriveInfo> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        extern "system" {
            fn GetLogicalDrives() -> u32;
            fn GetDriveTypeW(lpRootPathName: *const u16) -> u32;
        }

        let bitmask = unsafe { GetLogicalDrives() };
        for i in 0..26 {
            if (bitmask & (1 << i)) != 0 {
                let letter = (b'A' + i) as char;
                let drive_path = format!("{}:\\", letter);
                let wide_path: Vec<u16> = drive_path.encode_utf16().chain(std::iter::once(0)).collect();
                let drive_type_code = unsafe { GetDriveTypeW(wide_path.as_ptr()) };

                // 2 = REMOVABLE, 3 = FIXED, 4 = REMOTE, 6 = RAMDISK
                let (should_include, type_str, label) = match drive_type_code {
                    2 => (true, "removable", format!("Removable Disk ({}:)", letter)),
                    3 => (true, "fixed", format!("Local Disk ({}:)", letter)),
                    4 => (true, "network", format!("Network Drive ({}:)", letter)),
                    5 => (false, "cdrom", format!("CD Drive ({}:)", letter)),
                    6 => (true, "ramdisk", format!("RAM Disk ({}:)", letter)),
                    _ => (false, "unknown", format!("Drive ({}:)", letter)),
                };

                if should_include {
                    drives.push(DriveInfo {
                        name: label,
                        path: drive_path,
                        drive_type: type_str.to_string(),
                    });
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            if !home.is_empty() && std::path::Path::new(&home).is_dir() {
                drives.push(DriveInfo {
                    name: format!("Home ({})", home),
                    path: home,
                    drive_type: "fixed".to_string(),
                });
            }
        }
        drives.push(DriveInfo {
            name: "Root (/)".to_string(),
            path: "/".to_string(),
            drive_type: "fixed".to_string(),
        });

        #[cfg(target_os = "macos")]
        let mount_roots = &["/Volumes"][..];
        #[cfg(not(target_os = "macos"))]
        let mount_roots = &["/media", "/mnt"][..];
        for mount_root in mount_roots {
            if let Ok(entries) = std::fs::read_dir(mount_root) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_dir() {
                            let p = entry.path();
                            let name = entry.file_name().to_string_lossy().to_string();
                            drives.push(DriveInfo {
                                name: format!("{} ({})", name, p.display()),
                                path: p.to_string_lossy().to_string(),
                                drive_type: "removable".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    if drives.is_empty() {
        drives.push(DriveInfo {
            name: "Local Disk (C:)".to_string(),
            path: "C:\\".to_string(),
            drive_type: "fixed".to_string(),
        });
    }

    drives
}

#[tauri::command]
pub async fn list_windows_drives() -> Vec<DriveInfo> {
    tauri::async_runtime::spawn_blocking(list_windows_drives_internal)
        .await
        .unwrap_or_default()
}

pub fn get_parent_directory_internal(path: &str) -> Option<String> {
    let clean = normalize_windows_path(path);
    if clean == "THIS_PC" || clean.is_empty() {
        return None;
    }
    let target = PathBuf::from(&clean);
    match target.parent() {
        Some(p) => {
            let p_str = normalize_windows_path(&p.to_string_lossy());
            if p_str.is_empty() || p_str == clean {
                Some("THIS_PC".to_string())
            } else {
                Some(p_str)
            }
        }
        None => Some("THIS_PC".to_string()),
    }
}

#[tauri::command]
pub async fn validate_path(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || {
        let clean = normalize_windows_path(&path);
        if clean == "THIS_PC" || clean.is_empty() {
            return true;
        }
        let p = Path::new(&clean);
        p.exists() && p.is_dir()
    })
    .await
    .unwrap_or(false)
}

#[tauri::command]
pub async fn validate_folder_path(path: String) -> bool {
    validate_path(path).await
}

#[tauri::command]
pub async fn get_parent_directory(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || get_parent_directory_internal(&path))
        .await
        .unwrap_or(Some("THIS_PC".to_string()))
}

#[tauri::command]
pub async fn create_directory(parent: String, name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let clean_parent = normalize_windows_path(&parent);
        if clean_parent == "THIS_PC" || clean_parent.is_empty() {
            return Err("Cannot create directory in This PC root".to_string());
        }
        let target_parent = PathBuf::from(&clean_parent);
        if !target_parent.exists() || !target_parent.is_dir() {
            return Err(format!("Parent directory '{}' does not exist", clean_parent));
        }
        let trimmed_name = name.trim();
        if trimmed_name.is_empty()
            || trimmed_name.contains("..")
            || trimmed_name.contains('/')
            || trimmed_name.contains('\\')
            || trimmed_name.contains('\0')
        {
            return Err("Directory name contains invalid characters".to_string());
        }
        let new_path = target_parent.join(trimmed_name);
        fs::create_dir(&new_path).map_err(|e| format!("Failed to create folder: {}", e))?;
        Ok(normalize_windows_path(&new_path.to_string_lossy()))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn get_user_home_dir() -> String {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        {
            std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| "C:\\".to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
        }
    })
    .await
    .unwrap_or_else(|_| {
        if cfg!(target_os = "windows") {
            "C:\\".to_string()
        } else {
            "/".to_string()
        }
    })
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<DirectoryListing, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if path.contains('\0') {
            return Err("Invalid path: contains null bytes".to_string());
        }
        let clean_input = normalize_windows_path(&path);

        // Virtual root: THIS_PC / Drives View
        if clean_input == "THIS_PC" || clean_input.is_empty() {
            let drives = list_windows_drives_internal();
            let mut items = Vec::new();
            for drive in drives {
                items.push(FileItem {
                    name: drive.name,
                    full_path: drive.path,
                    item_type: "directory".to_string(),
                    is_dir: true,
                    is_drive: true,
                    hidden: false,
                    modified_time: None,
                    size: 0,
                });
            }
            return Ok(DirectoryListing {
                path: "THIS_PC".to_string(),
                parent: None,
                items,
            });
        }

        let target_path = PathBuf::from(&clean_input);
        let metadata = fs::metadata(&target_path)
            .map_err(|error| filesystem_error("inspect folder", &target_path, &error))?;
        if !metadata.is_dir() {
            return Err(format!("Path '{}' is not a directory", clean_input));
        }

        let parent = get_parent_directory_internal(&clean_input);

        let read_res = fs::read_dir(&target_path)
            .map_err(|error| filesystem_error("read folder", &target_path, &error))?;

        let mut items = Vec::new();

        for entry in read_res.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let raw_item_path = entry.path().to_string_lossy().to_string();
            let full_path = normalize_windows_path(&raw_item_path);

            let file_type = entry.file_type().ok();
            let is_dir = file_type.as_ref().map(|ft| ft.is_dir()).unwrap_or(false);
            let item_type = if is_dir { "directory" } else { "file" };

            let metadata = entry.metadata().ok();
            let size = if is_dir { 0 } else { metadata.as_ref().map(|m| m.len()).unwrap_or(0) };
            let modified_time = metadata.as_ref().and_then(|m| m.modified().ok()).and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
            });

            let hidden = name.starts_with('.') || (cfg!(windows) && (name.starts_with('$') || name.starts_with('.')));

            items.push(FileItem {
                name,
                full_path,
                item_type: item_type.to_string(),
                is_dir,
                is_drive: false,
                hidden,
                modified_time,
                size,
            });
        }

        items.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        Ok(DirectoryListing {
            path: clean_input,
            parent,
            items,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

// Backward compatibility alias
#[tauri::command]
pub async fn list_folder_contents(path: String) -> Result<DirectoryListing, String> {
    list_directory(path).await
}

#[tauri::command]
pub async fn get_system_drives() -> Vec<String> {
    list_windows_drives().await.into_iter().map(|d| d.path).collect()
}

/// A search at a system-wide location is not consent to inspect every protected
/// folder on a Mac. Selecting a project (or entering a protected folder) makes
/// that directory the explicit scope for a recursive search.
fn folder_search_depth(path: &Path, requested: usize, macos: bool, home: Option<&Path>) -> usize {
    let broad_location = matches!(
        path.to_str(),
        Some("/" | "/Users" | "/Volumes" | "/Library" | "/System" | "/System/Volumes/Data"
            | "/private" | "/private/tmp" | "/private/var" | "/private/var/tmp" | "/private/var/folders")
    ) || path.parent() == Some(Path::new("/Volumes"))
        // Keep system trees shallow without disabling recursive search in an
        // explicitly selected temporary project (/tmp canonicalizes to /private/tmp).
        || ["/System", "/Library", "/private/etc", "/private/var/db", "/private/var/root"]
            .iter().any(|root| path.starts_with(*root))
        || home.is_some_and(|home| path == home || path == home.join("Library").as_path());
    if macos && broad_location {
        0
    } else {
        requested
    }
}

fn matching_locations(drives: Vec<DriveInfo>, query: &str, limit: usize) -> Vec<FileItem> {
    drives
        .into_iter()
        .filter(|drive| {
            drive.name.to_lowercase().contains(query) || drive.path.to_lowercase().contains(query)
        })
        .take(limit)
        .map(|drive| FileItem {
            name: drive.name,
            full_path: drive.path,
            item_type: "directory".into(),
            is_dir: true,
            is_drive: true,
            hidden: false,
            modified_time: None,
            size: 0,
        })
        .collect()
}

#[tauri::command]
pub async fn search_directory_folders(
    path: String,
    query: String,
    max_depth: Option<usize>,
    max_results: Option<usize>,
    show_hidden: Option<bool>,
) -> Result<Vec<FileItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if path.contains('\0') || query.contains('\0') {
            return Err("Invalid input: contains null bytes".to_string());
        }
        let clean_input = normalize_windows_path(&path);
        let query_lower = query.trim().to_lowercase();
        if query_lower.is_empty() {
            return Ok(Vec::new());
        }

        let max_results = max_results.unwrap_or(200);
        let include_hidden = show_hidden.unwrap_or(false);

        // The virtual location picker is not a filesystem search root. In
        // particular, do not recursively scan both Home and / for every keypress.
        if clean_input == "THIS_PC" || clean_input.is_empty() {
            return Ok(matching_locations(
                list_windows_drives_internal(), &query_lower, max_results,
            ));
        }
        // Apply privacy boundaries to the physical path too: a symlink to Home
        // or a volume root must not turn a shallow search into a full disk scan.
        let physical_root = fs::canonicalize(&clean_input).map_err(|error| {
            filesystem_error("inspect search folder", Path::new(&clean_input), &error)
        })?;
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| fs::canonicalize(&path).unwrap_or(path));
        let max_depth = folder_search_depth(
            &physical_root, max_depth.unwrap_or(8), cfg!(target_os = "macos"), home.as_deref(),
        );
        let roots = vec![PathBuf::from(&clean_input)];

        let mut results = Vec::new();
        let mut queue: std::collections::VecDeque<(PathBuf, usize)> = std::collections::VecDeque::new();
        for r in roots {
            let metadata = fs::metadata(&r)
                .map_err(|error| filesystem_error("inspect search folder", &r, &error))?;
            if !metadata.is_dir() {
                return Err(format!("Path '{}' is not a directory", r.display()));
            }
            queue.push_back((r, 0));
        }

        while let Some((current_dir, depth)) = queue.pop_front() {
            if results.len() >= max_results {
                break;
            }

            let read_dir = match fs::read_dir(&current_dir) {
                Ok(rd) => rd,
                Err(error) if depth == 0 => {
                    return Err(filesystem_error("search folder", &current_dir, &error));
                }
                Err(_) => continue,
            };

            for entry in read_dir.flatten() {
                if results.len() >= max_results {
                    break;
                }

                let file_type = match entry.file_type() {
                    Ok(ft) => ft,
                    Err(_) => continue,
                };

                if !file_type.is_dir() {
                    continue;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                let is_hidden = name.starts_with('.') || (cfg!(windows) && (name.starts_with('$') || name.starts_with('.')));

                if is_hidden && !include_hidden {
                    continue;
                }

                let entry_path = entry.path();
                let full_path = normalize_windows_path(&entry_path.to_string_lossy());

                if name.to_lowercase().contains(&query_lower) {
                    let metadata = entry.metadata().ok();
                    let modified_time = metadata.as_ref().and_then(|m| m.modified().ok()).and_then(|t| {
                        t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
                    });

                    results.push(FileItem {
                        name: name.clone(),
                        full_path: full_path.clone(),
                        item_type: "directory".to_string(),
                        is_dir: true,
                        is_drive: false,
                        hidden: is_hidden,
                        modified_time,
                        size: 0,
                    });
                }

                let lower_name = name.to_lowercase();
                let is_blackhole = lower_name == "node_modules"
                    || lower_name == ".git"
                    || lower_name == "winsxs"
                    || lower_name == "$recycle.bin"
                    || lower_name == "system volume information";

                if depth + 1 < max_depth && !is_blackhole {
                    queue.push_back((entry_path, depth + 1));
                }
            }
        }

        Ok(results)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn macos_location_searches_do_not_recurse_into_unselected_private_folders() {
        let home = Path::new("/Users/developer");
        for root in [
            "/",
            "/Users",
            "/Volumes",
            "/Library",
            "/Library/Application Support",
            "/System",
            "/System/Volumes/Data",
            "/private",
            "/private/tmp",
            "/Users/developer",
            "/Users/developer/Library",
        ] {
            assert_eq!(folder_search_depth(Path::new(root), 8, true, Some(home)), 0);
        }
        // Opening a specific project or Documents folder is explicit user scope.
        for project in ["/Users/developer/Projects", "/Users/developer/Documents", "/Users/developer-other",
            "/private/tmp/selected-project", "/private/var/folders/ab/session/T/selected-project"] {
            assert_eq!(folder_search_depth(Path::new(project), 8, true, Some(home)), 8);
        }
        assert_eq!(folder_search_depth(home, 8, false, Some(home)), 8);
    }

    #[tokio::test]
    async fn shallow_folder_search_does_not_inspect_private_descendants() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("Documents/nested-project")).unwrap();
        fs::create_dir_all(root.path().join("top-project")).unwrap();
        let results = search_directory_folders(root.path().to_string_lossy().into_owned(), "project".into(), Some(0), None, None).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "top-project");
    }

    #[tokio::test]
    async fn missing_folder_search_is_an_error_not_an_empty_result() {
        let root = tempdir().unwrap();
        let result = search_directory_folders(root.path().join("missing").to_string_lossy().into_owned(), "project".into(), None, None, None).await;
        assert!(result.unwrap_err().contains("inspect search folder"));
    }

    #[test]
    fn resolves_relative_paths_inside_the_root() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("a.txt"), "x").unwrap();

        let resolved = resolve_path(root.path(), Path::new("a.txt")).unwrap();

        assert!(resolved.inside_root);
        assert!(resolved.exists);
        assert!(!resolved.is_dir);
        assert_eq!(
            resolved.path,
            root.path().canonicalize().unwrap().join("a.txt")
        );
    }

    #[test]
    fn flags_absolute_paths_outside_the_root() {
        let root = tempdir().unwrap();
        let other = tempdir().unwrap();

        let resolved = resolve_path(root.path(), &other.path().join("b.txt")).unwrap();

        assert!(!resolved.inside_root);
        assert!(!resolved.exists);
    }

    #[test]
    fn dot_dot_through_a_missing_folder_cannot_escape() {
        let root = tempdir().unwrap();

        let resolved =
            resolve_path(root.path(), Path::new("missing/../../escaped.txt")).unwrap();

        assert!(!resolved.inside_root);
    }

    #[test]
    fn dot_dot_that_stays_inside_is_inside() {
        let root = tempdir().unwrap();

        let resolved = resolve_path(root.path(), Path::new("src/../notes.md")).unwrap();

        assert!(resolved.inside_root);
        assert_eq!(
            resolved.path,
            root.path().canonicalize().unwrap().join("notes.md")
        );
    }

    #[test]
    fn the_root_itself_is_inside() {
        let root = tempdir().unwrap();

        let resolved = resolve_path(root.path(), Path::new(".")).unwrap();

        assert!(resolved.inside_root);
        assert!(resolved.is_dir);
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_pointing_outside_are_flagged() {
        let root = tempdir().unwrap();
        let outside = tempdir().unwrap();
        fs::write(outside.path().join("secret.txt"), "s").unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join("dir-link")).unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("secret.txt"),
            root.path().join("file-link"),
        )
        .unwrap();

        let through_dir = resolve_path(root.path(), Path::new("dir-link/secret.txt")).unwrap();
        let file_link = resolve_path(root.path(), Path::new("file-link")).unwrap();

        assert!(!through_dir.inside_root);
        assert!(!file_link.inside_root);
        assert_eq!(
            file_link.path,
            root.path().canonicalize().unwrap().join("file-link")
        );
    }

    #[test]
    fn reads_outside_the_root_are_rejected() {
        let root = tempdir().unwrap();
        let other = tempdir().unwrap();
        let outside_file = other.path().join("notes.txt");
        fs::write(&outside_file, "hello").unwrap();
        let root_arg = root.path().to_string_lossy().into_owned();
        let path_arg = outside_file.to_string_lossy().into_owned();

        let denied_default = read_text_file(root_arg.clone(), path_arg.clone(), None, None, None);
        let denied_with_flag = read_text_file(root_arg, path_arg, None, Some(true), None);

        assert!(denied_default.unwrap_err().contains("PermissionDeniedError"));
        assert!(denied_with_flag.unwrap_err().contains("PermissionDeniedError"));
    }

    #[test]
    fn file_reads_report_truncation_and_allow_exact_continuation() {
        let root = tempdir().unwrap();
        let content = format!("{}FINAL REQUIREMENT", "line\n".repeat(15_000));
        fs::write(root.path().join("prd.txt"), &content).unwrap();
        let root_arg = root.path().to_string_lossy().into_owned();
        let first = read_text_file(root_arg.clone(), "prd.txt".into(), None, None, None).unwrap();
        assert!(first.contains("nextOffset=65536; more=true"));
        let tail = read_text_file(root_arg, "prd.txt".into(), Some(64 * 1024), None, Some(65536)).unwrap();
        assert!(tail.ends_with("FINAL REQUIREMENT"));
        assert!(tail.contains("more=false"));
    }

    #[test]
    fn file_read_continuation_preserves_utf8_boundaries() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("unicode.txt"), "aa漢z").unwrap();
        let root_arg = root.path().to_string_lossy().into_owned();
        let first = read_text_file(root_arg.clone(), "unicode.txt".into(), Some(4), None, None).unwrap();
        assert!(first.contains("nextOffset=2"));
        assert!(first.ends_with("aa"));
        let next = read_text_file(root_arg, "unicode.txt".into(), Some(4), None, Some(2)).unwrap();
        assert!(next.ends_with("漢z"));
        assert!(!next.contains('\u{fffd}'));
    }

    #[test]
    fn validate_and_resolve_normal_access() {
        let root = tempdir().unwrap();
        fs::write(root.path().join("a.txt"), "content").unwrap();

        let resolved = validate_and_resolve_path(Path::new("a.txt"), root.path()).unwrap();
        assert_eq!(
            resolved,
            root.path().canonicalize().unwrap().join("a.txt")
        );
    }

    #[test]
    fn validate_and_resolve_relative_paths() {
        let root = tempdir().unwrap();
        let sub = root.path().join("src/lib");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("mod.rs"), "pub mod test;").unwrap();

        let res1 = validate_and_resolve_path(Path::new("src/lib/mod.rs"), root.path()).unwrap();
        let res2 = validate_and_resolve_path(Path::new("./src/lib/../lib/mod.rs"), root.path()).unwrap();

        let expected = root.path().canonicalize().unwrap().join("src/lib/mod.rs");
        assert_eq!(res1, expected);
        assert_eq!(res2, expected);
    }

    #[test]
    fn validate_and_resolve_dot_dot_traversal_attempts() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join("src")).unwrap();

        let err1 = validate_and_resolve_path(Path::new("../../secret.txt"), root.path()).unwrap_err();
        assert!(err1.to_string().contains("Access outside workspace root is denied"));

        let err2 = validate_and_resolve_path(Path::new("src/../../outside.txt"), root.path()).unwrap_err();
        assert!(err2.to_string().contains("Access outside workspace root is denied"));

        let err3 = validate_and_resolve_path(Path::new("./../escape"), root.path()).unwrap_err();
        assert!(err3.to_string().contains("Access outside workspace root is denied"));
    }

    #[test]
    fn validate_and_resolve_absolute_path_bypass_attempts() {
        let root = tempdir().unwrap();
        let other = tempdir().unwrap();
        let secret = other.path().join("secret.txt");
        fs::write(&secret, "sensitive").unwrap();

        let err = validate_and_resolve_path(&secret, root.path()).unwrap_err();
        assert!(err.to_string().contains("Access outside workspace root is denied"));
    }

    #[cfg(unix)]
    #[test]
    fn validate_and_resolve_symlink_escape_attempts() {
        let root = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let outside_file = outside.path().join("secret.txt");
        fs::write(&outside_file, "secret-data").unwrap();

        let link = root.path().join("symlink_to_secret");
        std::os::unix::fs::symlink(&outside_file, &link).unwrap();

        let err = validate_and_resolve_path(Path::new("symlink_to_secret"), root.path()).unwrap_err();
        assert!(err.to_string().contains("Access outside workspace root is denied"));

        let dir_link = root.path().join("symlink_dir");
        std::os::unix::fs::symlink(outside.path(), &dir_link).unwrap();

        let err_dir = validate_and_resolve_path(Path::new("symlink_dir/secret.txt"), root.path()).unwrap_err();
        assert!(err_dir.to_string().contains("Access outside workspace root is denied"));
    }

    #[test]
    fn list_dir_and_grep_prevent_bypasses() {
        let root = tempdir().unwrap();
        let root_str = root.path().to_string_lossy().to_string();

        let list_err = list_dir(root_str.clone(), "../../".into(), Some(true)).unwrap_err();
        assert!(list_err.contains("PermissionDeniedError"));

        let grep_err = grep_repo(root_str, "foo".into(), None, Some("../outside".into()), Some(true)).unwrap_err();
        assert!(grep_err.contains("PermissionDeniedError"));
    }
}

#[cfg(all(test, unix))]
mod unix_path_tests {
    use super::*;
    #[test]
    fn allows_unix_filenames_with_colons_without_relaxing_workspace_scope() {
        let root = tempfile::tempdir().unwrap();
        let file = root.path().join("notes:2026.txt");
        std::fs::write(&file, "hello").unwrap();
        let resolved = validate_and_resolve_path(Path::new("notes:2026.txt"), root.path()).unwrap();
        assert_eq!(resolved, file.canonicalize().unwrap());
        assert!(validate_and_resolve_path(Path::new("../outside:notes"), root.path()).is_err());
    }
}
