import { invoke } from "@tauri-apps/api/core";

export interface DriveInfo {
  driveType: "fixed" | "removable" | "network" | "ramdisk" | "unknown";
  name: string;
  path: string;
}

export interface FileItem {
  fullPath: string;
  hidden: boolean;
  isDir: boolean;
  isDrive?: boolean;
  itemType: "directory" | "file";
  modifiedTime?: number;
  name: string;
  size: number;
}

export interface DirectoryListing {
  items: FileItem[];
  parent?: string | null;
  path: string;
}

function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export function isWindowsPlatform(): boolean {
  if (typeof navigator !== "undefined") {
    const uaData = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData;
    const hints = [uaData?.platform, navigator.platform, navigator.userAgent];
    if (hints.some((hint) => hint && /win(?:dows|32|64)/i.test(hint))) {
      return true;
    }
    if (hints.some(Boolean)) {
      return false;
    }
  }
  if (typeof process !== "undefined" && process.platform) {
    return process.platform === "win32";
  }
  return false;
}

/**
 * Normalizes Windows & POSIX paths cleanly according to path syntax and platform
 */
export function normalizeWindowsPath(inputPath: string): string {
  if (!inputPath || inputPath === "THIS_PC") {
    return "THIS_PC";
  }
  const trimmed = inputPath.trim();

  // Explicit POSIX path (starts with /) or Unix environment when not a Windows drive path
  const isExplicitWindows =
    /^[a-zA-Z]:[/\\]?/.test(trimmed) || trimmed.startsWith("\\\\");
  const isPosix =
    trimmed.startsWith("/") || !(isExplicitWindows || isWindowsPlatform());

  if (isPosix) {
    let p = trimmed.replace(/\\/g, "/");
    // Collapse consecutive slashes
    p = p.replace(/\/+/g, "/");
    if (p === "/") {
      return "/";
    }
    if (p.length > 1 && p.endsWith("/")) {
      p = p.slice(0, -1);
    }
    return p;
  }

  // Windows path normalization
  let path = trimmed.replace(/\//g, "\\");
  if (path.startsWith("\\\\?\\")) {
    path = path.slice(4);
  }
  if (/^[a-zA-Z]:\\?$/.test(path)) {
    return `${path.slice(0, 2)}\\`;
  }
  if (path.length > 3 && path.endsWith("\\")) {
    path = path.slice(0, -1);
  }
  return path;
}

/**
 * Asynchronously lists active system drives / volumes
 */
export async function listWindowsDrives(): Promise<DriveInfo[]> {
  if (isTauriEnvironment()) {
    try {
      const drives = await invoke<DriveInfo[]>("list_windows_drives");
      return drives.map((d) => ({
        ...d,
        path: normalizeWindowsPath(d.path),
      }));
    } catch (error) {
      throw new Error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not load filesystem locations."
      );
    }
  }

  // Browser Fallback Mode
  if (!isWindowsPlatform()) {
    return [
      { name: "Home", path: "/home", driveType: "fixed" },
      { name: "Root (/)", path: "/", driveType: "fixed" },
    ];
  }
  return [
    { name: "Local Disk (C:)", path: "C:\\", driveType: "fixed" },
    { name: "Local Disk (D:)", path: "D:\\", driveType: "fixed" },
    { name: "Projects (E:)", path: "E:\\", driveType: "fixed" },
  ];
}

/**
 * Validates if a target path exists and is a valid directory
 */
export async function validatePath(targetPath: string): Promise<boolean> {
  const norm = normalizeWindowsPath(targetPath);
  if (!norm || norm === "THIS_PC") {
    return true;
  }

  if (isTauriEnvironment()) {
    try {
      return await invoke<boolean>("validate_path", { path: norm });
    } catch {
      return false;
    }
  }

  // Browser Fallback Mode: reject fake test string "asdasd"
  if (norm.toLowerCase().includes("asdasd")) {
    return false;
  }
  return true;
}

/**
 * Gets parent directory path or "THIS_PC"
 */
export async function getParentDirectory(
  targetPath: string
): Promise<string | null> {
  const norm = normalizeWindowsPath(targetPath);
  if (norm === "THIS_PC") {
    return null;
  }

  if (isTauriEnvironment()) {
    try {
      return await invoke<string | null>("get_parent_directory", {
        path: norm,
      });
    } catch {
      return "THIS_PC";
    }
  }

  const isPosix = norm.startsWith("/");
  if (isPosix) {
    if (norm === "/") {
      return "THIS_PC";
    }
    const idx = norm.lastIndexOf("/");
    if (idx === 0) {
      return "/";
    }
    if (idx > 0) {
      return norm.slice(0, idx);
    }
    return "THIS_PC";
  }

  const idx = norm.lastIndexOf("\\");
  if (idx > 2) {
    return norm.slice(0, idx);
  }
  return "THIS_PC";
}

/**
 * Creates a new directory at parent path
 */
export async function createDirectory(
  parentPath: string,
  folderName: string
): Promise<string> {
  const normParent = normalizeWindowsPath(parentPath);
  if (normParent === "THIS_PC") {
    throw new Error("Cannot create folder in This PC root");
  }

  if (isTauriEnvironment()) {
    const createdPath = await invoke<string>("create_directory", {
      parent: normParent,
      name: folderName,
    });
    return normalizeWindowsPath(createdPath);
  }

  const separator = normParent.includes("/") ? "/" : "\\";
  return normalizeWindowsPath(
    normParent.endsWith(separator)
      ? `${normParent}${folderName}`
      : `${normParent}${separator}${folderName}`
  );
}

/**
 * Asynchronously searches for folders matching a query recursively under basePath
 */
export async function searchDirectoryFolders(
  basePath: string,
  query: string,
  options?: { maxDepth?: number; maxResults?: number; showHidden?: boolean }
): Promise<FileItem[]> {
  const norm = normalizeWindowsPath(basePath);
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  if (isTauriEnvironment()) {
    try {
      const results = await invoke<FileItem[]>("search_directory_folders", {
        path: norm,
        query: trimmed,
        maxDepth: options?.maxDepth ?? 8,
        maxResults: options?.maxResults ?? 200,
        showHidden: options?.showHidden ?? false,
      });
      return results.map((item) => ({
        ...item,
        fullPath: normalizeWindowsPath(item.fullPath),
      }));
    } catch (error) {
      // An OS denial must stay visible; returning [] disguises it as an empty
      // search and encourages repeated attempts against the same protected path.
      throw new Error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Could not search this folder."
      );
    }
  }

  // Browser Fallback Mode
  const qLower = trimmed.toLowerCase();
  const mockSubdirs = [
    { name: `${trimmed}-utils`, sub: `packages\\core\\src\\${trimmed}-utils` },
    {
      name: `${trimmed}-components`,
      sub: `packages\\ui\\src\\components\\${trimmed}`,
    },
    { name: `nested-${trimmed}`, sub: `src\\features\\nested-${trimmed}` },
  ];

  return mockSubdirs
    .filter((m) => m.name.toLowerCase().includes(qLower))
    .map((m) => ({
      name: m.name,
      fullPath: norm === "THIS_PC" ? `C:\\${m.sub}` : `${norm}\\${m.sub}`,
      itemType: "directory" as const,
      isDir: true,
      isDrive: false,
      hidden: false,
      size: 0,
      modifiedTime: Date.now() / 1000 - 1800,
    }));
}

/**
 * Asynchronously loads a directory's files and subfolders
 */
export async function listDirectory(
  targetPath: string
): Promise<DirectoryListing> {
  const norm = normalizeWindowsPath(targetPath);

  if (isTauriEnvironment()) {
    try {
      const res = await invoke<DirectoryListing>("list_directory", {
        path: norm,
      });
      return {
        path:
          res.path === "THIS_PC" ? "THIS_PC" : normalizeWindowsPath(res.path),
        parent: res.parent ? normalizeWindowsPath(res.parent) : null,
        items: res.items.map((item) => ({
          ...item,
          fullPath: normalizeWindowsPath(item.fullPath),
        })),
      };
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || String(err);
      throw new Error(msg);
    }
  }

  // Browser Fallback Mode
  if (norm === "THIS_PC") {
    const drives = await listWindowsDrives();
    return {
      path: "THIS_PC",
      parent: null,
      items: drives.map((d) => ({
        name: d.name,
        fullPath: d.path,
        itemType: "directory",
        isDir: true,
        isDrive: true,
        hidden: false,
        size: 0,
      })),
    };
  }

  const isPosix = norm.startsWith("/");
  const separator = isPosix ? "/" : "\\";
  const parent = isPosix
    ? norm === "/"
      ? "THIS_PC"
      : norm.lastIndexOf("/") === 0
        ? "/"
        : norm.slice(0, norm.lastIndexOf("/"))
    : norm.length > 3
      ? norm.slice(0, norm.lastIndexOf("\\")) || "C:\\"
      : "THIS_PC";

  const joinChild = (child: string) =>
    `${norm}${norm.endsWith(separator) ? "" : separator}${child}`;

  return {
    path: norm,
    parent,
    items: [
      {
        name: "src",
        fullPath: joinChild("src"),
        itemType: "directory",
        isDir: true,
        hidden: false,
        size: 0,
        modifiedTime: Date.now() / 1000 - 3600,
      },
      {
        name: "packages",
        fullPath: joinChild("packages"),
        itemType: "directory",
        isDir: true,
        hidden: false,
        size: 0,
        modifiedTime: Date.now() / 1000 - 86_400,
      },
      {
        name: "public",
        fullPath: joinChild("public"),
        itemType: "directory",
        isDir: true,
        hidden: false,
        size: 0,
        modifiedTime: Date.now() / 1000 - 172_800,
      },
      {
        name: ".github",
        fullPath: joinChild(".github"),
        itemType: "directory",
        isDir: true,
        hidden: true,
        size: 0,
        modifiedTime: Date.now() / 1000 - 259_200,
      },
      {
        name: "README.md",
        fullPath: joinChild("README.md"),
        itemType: "file",
        isDir: false,
        hidden: false,
        size: 1420,
        modifiedTime: Date.now() / 1000 - 1800,
      },
      {
        name: "package.json",
        fullPath: joinChild("package.json"),
        itemType: "file",
        isDir: false,
        hidden: false,
        size: 2340,
        modifiedTime: Date.now() / 1000 - 900,
      },
    ],
  };
}
