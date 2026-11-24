import {
  isWindowsPlatform,
  listDirectory as listDirService,
  listWindowsDrives as listDrivesService,
  normalizeWindowsPath,
  validatePath as validatePathService,
} from "./filesystem-service";

export type {
  DirectoryListing,
  DriveInfo,
  FileItem,
} from "./filesystem-service";

// Legacy type alias for FolderItem
export interface FolderItem {
  fullPath?: string;
  hidden?: boolean;
  isDir: boolean;
  isDrive?: boolean;
  isHidden: boolean;
  itemType?: "directory" | "file";
  modifiedAt?: number;
  modifiedTime?: number;
  name: string;
  path: string;
  size: number;
}

export interface FolderContentResult {
  items: FolderItem[];
  parent?: string | null;
  path: string;
}

export function normalizePathDisplay(inputPath: string): string {
  return normalizeWindowsPath(inputPath);
}

export async function validateFolderPath(targetPath: string): Promise<boolean> {
  return validatePathService(targetPath);
}

export async function getUserHomeDir(): Promise<string> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const home = await invoke<string>("get_user_home_dir");
    return normalizeWindowsPath(home);
  } catch {
    return isWindowsPlatform() ? "C:\\" : "/";
  }
}

export async function fetchSystemLocations(): Promise<
  { driveType: string; name: string; path: string }[]
> {
  const drives = await listDrivesService();
  return drives.map((d) => ({
    driveType: d.driveType,
    name: d.name,
    path: d.path,
  }));
}

export async function fetchSystemDrives(): Promise<string[]> {
  const drives = await listDrivesService();
  return drives.map((d) => d.path);
}

export async function fetchFolderContents(
  targetPath: string
): Promise<FolderContentResult> {
  const listing = await listDirService(targetPath);
  return {
    path: listing.path,
    parent: listing.parent,
    items: listing.items.map((item) => ({
      name: item.name,
      path: item.fullPath,
      fullPath: item.fullPath,
      isDir: item.isDir,
      isDrive: item.isDrive,
      isHidden: item.hidden,
      hidden: item.hidden,
      itemType: item.itemType,
      size: item.size,
      modifiedAt: item.modifiedTime,
      modifiedTime: item.modifiedTime,
    })),
  };
}

export async function searchFolders(
  basePath: string,
  query: string,
  showHidden = false
): Promise<FolderItem[]> {
  const { searchDirectoryFolders } = await import("./filesystem-service");
  const items = await searchDirectoryFolders(basePath, query, { showHidden });
  return items.map((item) => ({
    name: item.name,
    path: item.fullPath,
    fullPath: item.fullPath,
    isDir: item.isDir,
    isDrive: item.isDrive,
    isHidden: item.hidden,
    hidden: item.hidden,
    itemType: item.itemType,
    size: item.size,
    modifiedAt: item.modifiedTime,
    modifiedTime: item.modifiedTime,
  }));
}

export function getBreadcrumbSegments(
  currentPath: string
): { name: string; path: string }[] {
  const norm = normalizeWindowsPath(currentPath);
  if (!norm || norm === "THIS_PC") {
    return [{ name: "This PC", path: "THIS_PC" }];
  }

  const isWindows = /^[a-zA-Z]:\\/.test(norm);
  const segments: { name: string; path: string }[] = [];

  segments.push({ name: "This PC", path: "THIS_PC" });

  if (isWindows) {
    const drivePrefix = norm.slice(0, 3);
    const driveLetter = drivePrefix.slice(0, 2).toUpperCase();
    const driveName = `Local Disk (${driveLetter})`;
    segments.push({ name: driveName, path: drivePrefix });
    const rest = norm.slice(3);
    if (rest) {
      const parts = rest.split("\\").filter(Boolean);
      let accumulated = drivePrefix;
      for (const part of parts) {
        accumulated = accumulated.endsWith("\\")
          ? `${accumulated}${part}`
          : `${accumulated}\\${part}`;
        segments.push({ name: part, path: accumulated });
      }
    }
  } else {
    segments.push({ name: "Root (/)", path: "/" });
    const parts = norm.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated = `${accumulated}/${part}`;
      segments.push({ name: part, path: accumulated });
    }
  }

  return segments;
}
