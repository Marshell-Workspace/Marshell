"use client";

import { ErrorBoundary } from "@workspace/core/components/common/error-boundary";
import { MacNativePathPicker } from "@workspace/core/components/common/mac-native-path-picker";
import "./folder-picker/folder-picker.css";
import {
  FluentAlert,
  FluentArrowLeft,
  FluentArrowRight,
  FluentArrowUp,
  FluentCheckmark,
  FluentDesktop,
  FluentDismiss,
  FluentFolder,
  FluentFolderAdd,
  FluentFolderOpen,
  FluentHardDrive,
  FluentRefresh,
  FluentSearch,
  getFolderGlyph,
  MarshallLogoMark,
} from "@workspace/core/components/common/folder-picker/icons";
import {
  createDirectory,
  getParentDirectory,
  isWindowsPlatform,
} from "@workspace/core/lib/filesystem-service";
import {
  type FolderContentResult,
  type FolderItem,
  fetchFolderContents,
  fetchSystemLocations,
  getBreadcrumbSegments,
  normalizePathDisplay,
  searchFolders,
  validateFolderPath,
} from "@workspace/core/lib/folder-picker-client";
import { Button } from "@workspace/ui/components/button";
import { DialogPrimitive } from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  useGeniePopupAnimation,
  usePopupController,
} from "@workspace/ui/lib/popup-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

export interface FolderPickerDialogProps {
  /** Initial directory path when opening */
  initialPath?: string;
  /** "folder" (default) picks a directory; "file" lists files too and picks a file. */
  mode?: "file" | "folder";
  /** Controls dialog visibility */
  onOpenChange: (open: boolean) => void;
  /** Callback fired when the user confirms; receives a folder path, or a file path in file mode. */
  onSelectFolder: (selectedPath: string) => void;
  /** Dialog open state */
  open: boolean;
  /** Custom title for the folder picker */
  title?: string;
}

export interface PathTab {
  id: string;
  isDrive?: boolean;
  isRoot?: boolean;
  name: string;
  path: string;
}

export interface NormalizedDrive {
  label: string;
  letter: string;
  path: string;
}

/**
 * Normalizes drive display name to ensure single "Local Disk (X:)" representation.
 */
export function normalizeDriveDisplayName(name: string, path?: string): string {
  const match = (path || name).match(/([A-Za-z]):/);
  if (match) {
    const letter = match[1]?.toUpperCase();
    return `Local Disk (${letter}:)`;
  }
  return name;
}

/**
 * Normalizes system drive info into clean letter, label, and path.
 */
export function normalizeDriveInfo(drivePathOrName: string): NormalizedDrive {
  const match = drivePathOrName.match(/([A-Za-z]):/);
  const letter = match ? `${match[1]?.toUpperCase()}:` : drivePathOrName;
  const path = match ? `${match[1]?.toUpperCase()}:\\` : drivePathOrName;
  return {
    letter,
    label: "Local Disk",
    path,
  };
}

const WINDOWS_DRIVE_RE = /^([A-Za-z]):/;
const PARENTHESIZED_SUFFIX_RE = /\s*\([^)]*\)\s*$/;
const TRAILING_SLASHES_RE = /[\\/]+$/;
const DRIVE_TYPE_LABELS: Record<string, string> = {
  fixed: "Local Disk",
  removable: "Removable Disk",
  network: "Network Drive",
  ramdisk: "RAM Disk",
};

/**
 * Name of the top-level "all drives" view. The sentinel path stays THIS_PC;
 * only the label is platform aware.
 */
export function getRootLabel(): string {
  return isWindowsPlatform() ? "This PC" : "Computer";
}

/**
 * Normalizes a backend location (Windows drive, macOS volume, Linux mount,
 * Home, Root) into a primary line, a secondary line and a path.
 */
export function normalizeLocation(location: {
  driveType?: string;
  name: string;
  path: string;
}): NormalizedDrive {
  if (WINDOWS_DRIVE_RE.test(location.path)) {
    const base = normalizeDriveInfo(location.path);
    return {
      ...base,
      label: DRIVE_TYPE_LABELS[location.driveType ?? "fixed"] ?? base.label,
    };
  }
  const base = location.name.replace(PARENTHESIZED_SUFFIX_RE, "").trim();
  return {
    letter: base || location.path,
    label: location.path,
    path: location.path,
  };
}

/**
 * Whether a location in the rail owns the current path. POSIX locations nest
 * (Root contains Home), so the longest matching location wins.
 */
export function isLocationActive(
  locationPath: string,
  currentPath: string,
  allPaths: string[]
): boolean {
  if (!currentPath || currentPath === "THIS_PC") {
    return false;
  }
  if (WINDOWS_DRIVE_RE.test(locationPath)) {
    return currentPath
      .toUpperCase()
      .startsWith(locationPath.slice(0, 2).toUpperCase());
  }
  const strip = (p: string) => p.replace(TRAILING_SLASHES_RE, "");
  const contains = (root: string, path: string) =>
    strip(root) === "" ||
    path === strip(root) ||
    path.startsWith(`${strip(root)}/`);
  if (!contains(locationPath, currentPath)) {
    return false;
  }
  return !allPaths.some(
    (other) =>
      other !== locationPath &&
      strip(other).length > strip(locationPath).length &&
      contains(other, currentPath)
  );
}

/**
 * Determines whether a given drive letter is active based on the current path.
 */
export function isDriveActive(
  driveLetter: string,
  currentPath: string
): boolean {
  if (!currentPath || currentPath === "THIS_PC") {
    return false;
  }
  const cleanLetter = driveLetter.replace(/\\$/, "").toUpperCase();
  const cleanPath = currentPath.toUpperCase();
  return cleanPath.startsWith(cleanLetter);
}

/**
 * Pure presentation helper deriving browser-style tabs from currentPath.
 */
export function deriveTabsFromPath(currentPath: string): PathTab[] {
  if (!currentPath || currentPath === "THIS_PC") {
    return [
      {
        id: "THIS_PC",
        name: "This PC",
        path: "THIS_PC",
        isRoot: true,
      },
    ];
  }

  // Handle UNC paths (e.g. \\server\share\folder)
  if (currentPath.startsWith("\\\\") || currentPath.startsWith("//")) {
    const clean = currentPath.replace(/^[\\/]{2}/, "").replace(/\//g, "\\");
    const parts = clean.split("\\").filter(Boolean);
    const tabs: PathTab[] = [
      {
        id: "THIS_PC",
        name: "This PC",
        path: "THIS_PC",
        isRoot: true,
      },
    ];
    let accum = "\\\\";
    parts.forEach((part, idx) => {
      accum = idx === 0 ? `\\\\${part}` : `${accum}\\${part}`;
      tabs.push({
        id: accum,
        name: part,
        path: accum,
        isDrive: idx <= 1,
      });
    });
    return tabs;
  }

  const segments = getBreadcrumbSegments(currentPath);
  return segments.map((seg, idx) => ({
    id: seg.path,
    name: seg.name,
    path: seg.path,
    ...(idx === 0 ? { isRoot: true } : {}),
    ...(idx === 1 && seg.path.includes(":") ? { isDrive: true } : {}),
  }));
}

/**
 * Pure presentation helper that calculates maximum visible tabs in the location bar.
 */
export function calculateMaxVisibleTabs(locationBarWidth: number): number {
  if (locationBarWidth <= 0) {
    return 4;
  }
  if (locationBarWidth < 260) {
    return 2;
  }
  if (locationBarWidth < 380) {
    return 3;
  }
  if (locationBarWidth < 520) {
    return 4;
  }
  return 5;
}

/**
 * Pure presentation helper that folds intermediate ancestors into a collapsed list.
 * Preserves the root ("This PC"), immediate parent (penultimate), and active tab (last).
 */
export function deriveTabOverflow(
  tabs: PathTab[],
  maxVisible = 4
): { displayed: PathTab[]; collapsed: PathTab[] } {
  if (tabs.length <= maxVisible) {
    return { displayed: tabs, collapsed: [] };
  }
  const first = tabs[0]!;
  const last = tabs.at(-1)!;
  if (maxVisible <= 2 || tabs.length === 3) {
    const collapsed = tabs.slice(1, tabs.length - 1);
    return { displayed: [first, last], collapsed };
  }
  const penultimate = tabs.at(-2)!;
  const collapsed = tabs.slice(1, tabs.length - 2);
  return { displayed: [first, penultimate, last], collapsed };
}

function formatDate(epochSecs?: number): string {
  if (!epochSecs) {
    return "—";
  }
  const date = new Date(epochSecs * 1000);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderFooterPath(path: string) {
  if (!path || path === "THIS_PC") {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <FluentDesktop className="size-4 shrink-0 text-[var(--fp-text-secondary)]" />
        <span className="text-[var(--fp-text-secondary)] font-medium text-xs">
          {getRootLabel()}
        </span>
      </div>
    );
  }

  const separator = path.includes("/") ? "/" : "\\";
  const lastSlash = path.lastIndexOf(separator);

  if (lastSlash < 0) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <FluentHardDrive className="size-4 shrink-0 text-[var(--fp-text-secondary)]" />
        <span className="text-[var(--fp-text-primary)] font-semibold text-xs truncate">
          {path}
        </span>
      </div>
    );
  }

  const ancestor = path.slice(0, lastSlash + 1);
  const leaf = path.slice(lastSlash + 1);

  return (
    <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
      <FluentHardDrive className="size-4 shrink-0 text-[var(--fp-text-secondary)]" />
      <div className="flex items-center min-w-0 text-xs overflow-hidden">
        <span
          className="text-[var(--fp-text-secondary)] truncate shrink-0 max-w-[260px]"
          title={ancestor}
        >
          {ancestor}
        </span>
        <span className="text-[var(--fp-text-primary)] font-semibold shrink-0">
          {leaf}
        </span>
      </div>
    </div>
  );
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  onSelectFolder,
  mode = "folder",
  initialPath = "",
  title = mode === "file" ? "Select File" : "Select Folder",
}: FolderPickerDialogProps) {
  const isFileMode = mode === "file";

  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>("THIS_PC");
  const [selectedFolderPath, setSelectedFolderPath] =
    useState<string>("THIS_PC");
  const [drivesList, setDrivesList] = useState<NormalizedDrive[]>([]);
  const [data, setData] = useState<FolderContentResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<FolderItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchReqIdRef = useRef<number>(0);
  const blockedSearchPathRef = useRef<string | null>(null);

  // Hidden Folders State
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Path Editing State (Dedicated separate state)
  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [editingPath, setEditingPath] = useState<string>("");

  // List Selection State
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  // File mode: true once a file (not a directory) is the current selection.
  const [selectedIsFile, setSelectedIsFile] = useState<boolean>(false);

  // New Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");

  // History Stack for Back / Forward
  const [history, setHistory] = useState<string[]>(["THIS_PC"]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Preview Pane State
  const [previewItems, setPreviewItems] = useState<FolderItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewReqIdRef = useRef<number>(0);
  const previewCacheRef = useRef<Map<string, FolderItem[]>>(new Map());

  // Responsive Width & Rail Roving Tabindex State
  const locationBarRef = useRef<HTMLDivElement>(null);
  const [locationBarWidth, setLocationBarWidth] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [focusedDriveIndex, setFocusedDriveIndex] = useState<number>(0);
  const driveItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Refs for DOM management & stale request cancellation
  const listRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const reqIdRef = useRef<number>(0);
  const pathInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef<boolean>(false);
  const openRef = useRef(open);
  openRef.current = open;

  // Mounting a hidden picker must not enumerate disks or protected locations.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      reqIdRef.current += 1;
      searchReqIdRef.current += 1;
      return;
    }
    let cancelled = false;
    fetchSystemLocations()
      .then((res) => {
        if (!cancelled && isMountedRef.current && res && res.length > 0) {
          setDrivesList(res.map(normalizeLocation));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && isMountedRef.current) {
          setError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Core asynchronous navigation loader with stale request cancellation
  const loadDirectory = useCallback(
    async (targetPath: string, pushHistory = false) => {
      if (!openRef.current) {
        return;
      }
      blockedSearchPathRef.current = null;
      const activeReqId = ++reqIdRef.current;
      setLoading(true);
      setError(null);
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      setSelectedIsFile(false);
      setIsCreatingFolder(false);
      setIsEditingPath(false);

      const normTarget = normalizePathDisplay(targetPath);

      try {
        const result = await fetchFolderContents(normTarget);

        if (activeReqId !== reqIdRef.current || !isMountedRef.current) {
          return;
        }

        const normPath =
          result.path === "THIS_PC"
            ? "THIS_PC"
            : normalizePathDisplay(result.path);

        setData(result);
        setCurrentPath(normPath);
        setSelectedFolderPath(normPath);

        if (pushHistory) {
          setHistory((prev) => {
            const next = prev.slice(0, historyIndex + 1);
            if (next.at(-1) !== normPath) {
              next.push(normPath);
            }
            setHistoryIndex(next.length - 1);
            return next;
          });
        }
      } catch (err: unknown) {
        if (activeReqId === reqIdRef.current && isMountedRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (activeReqId === reqIdRef.current && isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [historyIndex]
  );

  // Initialize directory on dialog open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setIsEditingPath(false);
      setSearchQuery("");
      setIsCreatingFolder(false);

      const init = async () => {
        const initializationId = ++reqIdRef.current;
        let startingPath = "THIS_PC";
        if (initialPath && initialPath !== "THIS_PC") {
          const isValid = await validateFolderPath(initialPath);
          if (isValid) {
            startingPath = normalizePathDisplay(initialPath);
          }
        }

        if (
          !(isMountedRef.current && openRef.current) ||
          initializationId !== reqIdRef.current
        ) {
          return;
        }
        setCurrentPath(startingPath);
        setSelectedFolderPath(startingPath);
        setHistory([startingPath]);
        setHistoryIndex(0);
        loadDirectory(startingPath, false);
      };
      init();
    }
    prevOpenRef.current = open;
  }, [open, initialPath, loadDirectory]);

  // Focus and select all text when Path Edit Mode is activated
  useEffect(() => {
    if (isEditingPath) {
      requestAnimationFrame(() => {
        if (pathInputRef.current) {
          pathInputRef.current.focus();
          pathInputRef.current.select();
        }
      });
    }
  }, [isEditingPath]);

  // Focus new folder input when inline prompt opens
  useEffect(() => {
    if (isCreatingFolder) {
      requestAnimationFrame(() => {
        newFolderInputRef.current?.focus();
      });
    }
  }, [isCreatingFolder]);

  // Back Navigation
  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevPath = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      if (prevPath) {
        loadDirectory(prevPath, false);
      }
    }
  };

  // Forward Navigation
  const handleGoForward = () => {
    if (historyIndex < history.length - 1) {
      const nextPath = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      if (nextPath) {
        loadDirectory(nextPath, false);
      }
    }
  };

  // Navigate Up to Parent Directory
  const handleGoUp = async () => {
    if (currentPath === "THIS_PC") {
      return;
    }
    if (data?.parent) {
      loadDirectory(data.parent, true);
    } else {
      const parent = await getParentDirectory(currentPath);
      loadDirectory(parent || "THIS_PC", true);
    }
  };

  // Refresh Directory (in This PC re-fetches drives and invalidates cache)
  const handleRefresh = useCallback(async () => {
    if (currentPath === "THIS_PC") {
      setLoading(true);
      try {
        const res = await fetchSystemLocations();
        if (isMountedRef.current && res && res.length > 0) {
          setDrivesList(res.map(normalizeLocation));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    } else {
      loadDirectory(currentPath, false);
    }
  }, [currentPath, loadDirectory]);

  // Filtered drives for rail (filtered by search in THIS_PC view)
  const filteredDrives = useMemo(() => {
    if (!searchQuery.trim()) {
      return drivesList;
    }
    const q = searchQuery.toLowerCase().trim();
    return drivesList.filter(
      (d) =>
        d.letter.toLowerCase().includes(q) || d.label.toLowerCase().includes(q)
    );
  }, [drivesList, searchQuery]);

  // Keyboard navigation on DRIVES rail (roving tabindex)
  const handleDriveKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(filteredDrives.length - 1, index + 1);
      setFocusedDriveIndex(next);
      driveItemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      setFocusedDriveIndex(prev);
      driveItemRefs.current[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedDriveIndex(0);
      driveItemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = filteredDrives.length - 1;
      setFocusedDriveIndex(last);
      driveItemRefs.current[last]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const drive = filteredDrives[index];
      if (drive) {
        loadDirectory(drive.path, true);
      }
    }
  };

  // Enter Path Edit Mode
  const startEditingPath = () => {
    const rawPath =
      currentPath === "THIS_PC"
        ? isWindowsPlatform()
          ? "C:\\"
          : "/"
        : currentPath;
    setEditingPath(rawPath);
    setIsEditingPath(true);
  };

  // Cancel Path Edit Mode
  const cancelEditingPath = () => {
    setIsEditingPath(false);
    setEditingPath("");
  };

  // Submit Edited Path
  const handleManualPathSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = editingPath.trim();
    if (!trimmed) {
      cancelEditingPath();
      return;
    }

    if (trimmed.toUpperCase() === "THIS_PC") {
      loadDirectory("THIS_PC", true);
      setIsEditingPath(false);
      return;
    }

    const isValid = await validateFolderPath(trimmed);
    if (isValid) {
      await loadDirectory(trimmed, true);
      setIsEditingPath(false);
    } else {
      toast.error(`Path "${trimmed}" does not exist`);
      requestAnimationFrame(() => {
        pathInputRef.current?.focus();
        pathInputRef.current?.select();
      });
    }
  };

  // Handle Double-Clicking an Item (Enter Directory)
  const handleItemDoubleClick = (item: FolderItem) => {
    if (item.isDir || item.isDrive) {
      loadDirectory(item.path, true);
    } else if (isFileMode) {
      confirmSelection(item.path, true);
    }
  };

  // Handle Single-Clicking an Item (Highlight & Select)
  const handleItemClick = (item: FolderItem, index: number) => {
    setSelectedIndex(index);
    if (item.isDir || item.isDrive) {
      setSelectedFolderPath(item.path);
      setSelectedIsFile(false);
    } else if (isFileMode) {
      setSelectedFolderPath(item.path);
      setSelectedIsFile(true);
    }
  };

  // Debounced asynchronous recursive search
  useEffect(() => {
    const activeSearchId = ++searchReqIdRef.current;
    if (!open || blockedSearchPathRef.current === currentPath) {
      setIsSearching(false);
      return;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (isFileMode) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchFolders(currentPath, trimmed, showHidden);
        if (activeSearchId === searchReqIdRef.current && isMountedRef.current) {
          setSearchResults(results);
          setIsSearching(false);
        }
      } catch (error: unknown) {
        if (activeSearchId === searchReqIdRef.current && isMountedRef.current) {
          setSearchResults([]);
          setIsSearching(false);
          // Typing more characters must not keep retrying the same rejected OS
          // operation. Navigation or the explicit refresh action permits a retry.
          blockedSearchPathRef.current = currentPath;
          setError(error instanceof Error ? error.message : String(error));
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [open, searchQuery, currentPath, showHidden, isFileMode]);

  const isSearchActive = searchQuery.trim().length > 0;

  // Items to display in folder list (shallow directory contents or recursive search results)
  const displayItems = useMemo(() => {
    if (isSearchActive && !isFileMode) {
      return searchResults;
    }
    if (!data?.items) {
      return [];
    }
    const needle = searchQuery.trim().toLowerCase();
    return data.items.filter((item) => {
      if (!(isFileMode || item.isDir || item.isDrive)) {
        return false;
      }
      if (!showHidden && item.isHidden) {
        return false;
      }
      if (isFileMode && needle && !item.name.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [
    isSearchActive,
    isFileMode,
    searchQuery,
    searchResults,
    data,
    showHidden,
  ]);

  // Selected item object for Preview Pane metadata
  const selectedItem = useMemo(() => {
    if (selectedIndex >= 0 && selectedIndex < displayItems.length) {
      return displayItems[selectedIndex];
    }
    return displayItems.find((it) => it.path === selectedFolderPath);
  }, [selectedIndex, displayItems, selectedFolderPath]);

  // Preview Pane Content Fetcher (Debounced 150ms, with memory cache and cancellation)
  useEffect(() => {
    if (
      !selectedFolderPath ||
      selectedFolderPath === "THIS_PC" ||
      selectedFolderPath === currentPath
    ) {
      setPreviewItems([]);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    // Check memory cache
    const cacheKey = `${selectedFolderPath}::${showHidden ? "all" : "visible"}`;
    if (previewCacheRef.current.has(cacheKey)) {
      setPreviewItems(previewCacheRef.current.get(cacheKey) ?? []);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    const activePreviewId = ++previewReqIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetchFolderContents(selectedFolderPath);
        if (
          activePreviewId === previewReqIdRef.current &&
          isMountedRef.current
        ) {
          const childFolders = res.items.filter(
            (it) => (it.isDir || it.isDrive) && (showHidden || !it.isHidden)
          );
          // Keep max 20 entries in LRU cache
          if (previewCacheRef.current.size > 20) {
            const firstKey = previewCacheRef.current.keys().next().value;
            if (firstKey) {
              previewCacheRef.current.delete(firstKey);
            }
          }
          previewCacheRef.current.set(cacheKey, childFolders);
          setPreviewItems(childFolders);
          setPreviewLoading(false);
        }
      } catch (err: unknown) {
        if (
          activePreviewId === previewReqIdRef.current &&
          isMountedRef.current
        ) {
          const msg = err instanceof Error ? err.message : String(err);
          setPreviewError(msg);
          setPreviewItems([]);
          setPreviewLoading(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedFolderPath, currentPath, showHidden]);

  // Confirms the current pick. Folder mode re-validates the directory; file mode takes the file as-is.
  const confirmSelection = async (path: string, isFile: boolean) => {
    const selectionRequestId = reqIdRef.current;
    if (!path || path === "THIS_PC") {
      return;
    }
    if (isFileMode) {
      if (!isFile) {
        return;
      }
    } else if (!(await validateFolderPath(path))) {
      toast.error("The selected directory path is invalid or inaccessible.");
      return;
    }
    if (
      !(isMountedRef.current && openRef.current) ||
      selectionRequestId !== reqIdRef.current
    ) {
      return;
    }
    onSelectFolder(path);
    onOpenChange(false);
  };

  // Create New Folder Submit
  const handleCreateFolderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setIsCreatingFolder(false);
      return;
    }

    if (currentPath === "THIS_PC") {
      toast.error(`Cannot create folder in ${getRootLabel()} root`);
      setIsCreatingFolder(false);
      return;
    }

    try {
      const createdPath = await createDirectory(currentPath, trimmed);
      setNewFolderName("");
      setIsCreatingFolder(false);
      await loadDirectory(currentPath, false);
      setSelectedFolderPath(createdPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed creating folder: ${msg}`);
    }
  };

  // Keyboard navigation within Folder Dialog
  const handleDialogKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const isInputFocused =
      target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

    // If an input is actively being typed in, allow normal input behavior
    if (isInputFocused) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (target === pathInputRef.current) {
          cancelEditingPath();
        } else if (target === searchInputRef.current) {
          setSearchQuery("");
        } else if (isCreatingFolder) {
          setIsCreatingFolder(false);
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.stopPropagation();
      onOpenChange(false);
      return;
    }

    if (displayItems.length === 0) {
      return;
    }

    const scrollToItem = (index: number) => {
      if (!listRef.current) {
        return;
      }
      const elements =
        listRef.current.querySelectorAll<HTMLElement>("[data-folder-item]");
      const targetEl = elements[index];
      if (targetEl) {
        targetEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const nextIdx = Math.min(prev + 1, displayItems.length - 1);
        scrollToItem(nextIdx);
        const item = displayItems[nextIdx];
        if (item) {
          setSelectedFolderPath(item.path);
          setSelectedIsFile(isFileMode && !(item.isDir || item.isDrive));
        }
        return nextIdx;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const prevIdx = Math.max(prev - 1, 0);
        scrollToItem(prevIdx);
        const item = displayItems[prevIdx];
        if (item) {
          setSelectedFolderPath(item.path);
          setSelectedIsFile(isFileMode && !(item.isDir || item.isDrive));
        }
        return prevIdx;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < displayItems.length) {
        const selected = displayItems[selectedIndex];
        if (selected?.isDir || selected?.isDrive) {
          loadDirectory(selected.path, true);
        } else if (selected && isFileMode) {
          confirmSelection(selected.path, true);
        }
      } else if (!isFileMode) {
        confirmSelection(selectedFolderPath, false);
      }
    } else if (e.key === "Backspace" && (e.altKey || e.ctrlKey)) {
      e.preventDefault();
      handleGoUp();
    }
  };

  const isRailCollapsed = containerWidth > 0 && containerWidth < 680;

  const searchPlaceholder = useMemo(() => {
    if (!currentPath || currentPath === "THIS_PC") {
      return "Search locations";
    }

    const norm = normalizePathDisplay(currentPath);

    if (/^[a-zA-Z]:\\?$/.test(norm)) {
      const driveLetter = norm.slice(0, 2).toUpperCase();
      return `Search "Local Disk (${driveLetter})"`;
    }

    if (norm === "/") {
      return 'Search "Root (/)"';
    }

    const lastSlashIdx = Math.max(
      norm.lastIndexOf("\\"),
      norm.lastIndexOf("/")
    );
    if (lastSlashIdx >= 0) {
      const folderName = norm.slice(lastSlashIdx + 1);
      if (folderName) {
        return `Search "${folderName}"`;
      }
    }

    return `Search "${norm}"`;
  }, [currentPath]);

  // Derive browser tabs from current path with responsive overflow grouping
  const tabs = useMemo(() => deriveTabsFromPath(currentPath), [currentPath]);

  const maxVisibleTabs = useMemo(
    () => calculateMaxVisibleTabs(locationBarWidth),
    [locationBarWidth]
  );

  const visibleTabs = useMemo(
    () => deriveTabOverflow(tabs, maxVisibleTabs),
    [tabs, maxVisibleTabs]
  );

  // ResizeObserver on Location Bar for responsive tab overflow
  useEffect(() => {
    if (!locationBarRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLocationBarWidth(entry.contentRect.width);
      }
    });
    observer.observe(locationBarRef.current);
    return () => observer.disconnect();
  }, [isEditingPath]);

  // ResizeObserver on Dialog Content for container width and rail collapse
  useEffect(() => {
    if (!dialogContentRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(dialogContentRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard initial focus on DRIVES rail when opening on THIS_PC
  useEffect(() => {
    if (open && currentPath === "THIS_PC") {
      requestAnimationFrame(() => {
        driveItemRefs.current[focusedDriveIndex]?.focus();
      });
    }
  }, [open, currentPath, focusedDriveIndex]);

  const { isRendered, isClosing, triggerSnapshotRef, completeClose } =
    usePopupController(open);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const dialogOverlayRef = useRef<HTMLDivElement | null>(null);

  useGeniePopupAnimation({
    open,
    isRendered,
    isClosing,
    contentRef: dialogContentRef,
    overlayRef: dialogOverlayRef,
    triggerSnapshotRef,
    kind: "dialog",
    completeClose,
  });

  const setDialogContentRef = useCallback((node: HTMLDivElement | null) => {
    dialogContentRef.current = node;
  }, []);

  const setDialogOverlayRef = useCallback((node: HTMLDivElement | null) => {
    dialogOverlayRef.current = node;
  }, []);

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      {isRendered && (
        <DialogPrimitive.Portal
          container={
            typeof document === "undefined" ? undefined : document.body
          }
          forceMount={true}
        >
          {/* Scrim Overlay */}
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-[100]",
              isClosing && "pointer-events-none"
            )}
            data-slot="folder-picker-overlay"
            forceMount={true}
            ref={setDialogOverlayRef}
          />

          {/* Modal Dialog Content Container (tabs live INSIDE) */}
          <DialogPrimitive.Content
            aria-describedby="folder-picker-description"
            aria-modal="true"
            className={cn(
              "folder-picker-root fixed top-1/2 left-1/2 z-[100] flex h-[700px] max-h-[88vh] w-[94vw] max-w-[1120px] -translate-x-1/2 -translate-y-1/2 flex-col outline-none select-none rounded-[14px] border border-[var(--fp-hairline)] bg-[var(--fp-surface-modal)] shadow-[var(--fp-shadow-modal)] overflow-hidden",
              isClosing && "pointer-events-none"
            )}
            data-genie-managed=""
            data-slot="folder-picker-dialog"
            data-tour-surface="select-folder"
            forceMount={true}
            inert={isClosing}
            onKeyDown={handleDialogKeyDown}
            ref={setDialogContentRef}
            role="dialog"
          >
            {/* Visually Hidden Accessible Name & Description for Dialog */}
            <DialogPrimitive.Title className="sr-only" id="folder-picker-title">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              className="sr-only"
              id="folder-picker-description"
            >
              {isFileMode
                ? "Browse system drives and select a file"
                : "Browse system drives and select a working directory"}
            </DialogPrimitive.Description>

            {/* Navigation & Controls Toolbar (Row 1 is now the top row of the modal) */}
            <div className="flex flex-col border-b border-[var(--fp-hairline)] bg-[var(--fp-surface-modal)] px-5 py-3 gap-3 shrink-0 z-10">
              {/* Row 1: Nav cluster [12px gap] Location Bar [12px gap] Search field [8px gap] Divider [8px gap] Close */}
              <div className="flex items-center min-w-0 h-10 gap-3">
                {/* Square Navigation Buttons: Back, Forward, Up, Refresh (40px tall) */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    aria-label="Back"
                    className="size-10 rounded-[8px] border border-transparent bg-transparent text-[var(--fp-text-secondary)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text-primary)] active:bg-[var(--fp-surface-active)] disabled:opacity-30 disabled:pointer-events-none transition-ui motion-fast p-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    disabled={historyIndex <= 0}
                    onClick={handleGoBack}
                    size="icon"
                    title="Back"
                    variant="ghost"
                  >
                    <FluentArrowLeft className="size-4" />
                  </Button>

                  <Button
                    aria-label="Forward"
                    className="size-10 rounded-[8px] border border-transparent bg-transparent text-[var(--fp-text-secondary)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text-primary)] active:bg-[var(--fp-surface-active)] disabled:opacity-30 disabled:pointer-events-none transition-ui motion-fast p-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    disabled={historyIndex >= history.length - 1}
                    onClick={handleGoForward}
                    size="icon"
                    title="Forward"
                    variant="ghost"
                  >
                    <FluentArrowRight className="size-4" />
                  </Button>

                  <Button
                    aria-label="Up to parent folder"
                    className="size-10 rounded-[8px] border border-transparent bg-transparent text-[var(--fp-text-secondary)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text-primary)] active:bg-[var(--fp-surface-active)] disabled:opacity-30 disabled:pointer-events-none transition-ui motion-fast p-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    disabled={currentPath === "THIS_PC"}
                    onClick={handleGoUp}
                    size="icon"
                    title="Up to parent folder"
                    variant="ghost"
                  >
                    <FluentArrowUp className="size-4" />
                  </Button>

                  <Button
                    aria-label="Refresh directory"
                    className="size-10 rounded-[8px] border border-transparent bg-transparent text-[var(--fp-text-secondary)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text-primary)] active:bg-[var(--fp-surface-active)] transition-ui motion-fast p-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    onClick={handleRefresh}
                    size="icon"
                    title="Refresh directory"
                    variant="ghost"
                  >
                    <FluentRefresh
                      className={cn("size-4", loading && "animate-spin")}
                    />
                  </Button>
                </div>

                {/* Location Bar with Integrated Browser-Style Tabs */}
                <div
                  className={cn(
                    "fp-location-bar",
                    isEditingPath && "fp-location-bar-editing"
                  )}
                  ref={locationBarRef}
                >
                  {isEditingPath ? (
                    <form
                      className="flex w-full h-full items-center min-w-0 flex-1 gap-1.5 px-1"
                      onSubmit={handleManualPathSubmit}
                    >
                      <input
                        aria-label="Folder path"
                        autoComplete="off"
                        className="h-full w-full border-none bg-transparent fp-font-mono text-xs text-[var(--fp-text-primary)] focus:outline-none focus:ring-0 px-2 py-0 shadow-none outline-none flex-1 min-w-0"
                        onChange={(e) => setEditingPath(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            cancelEditingPath();
                          }
                        }}
                        ref={pathInputRef}
                        spellCheck={false}
                        type="text"
                        value={editingPath}
                      />
                      <Button
                        className="h-7 px-2.5 text-[11px] shrink-0 font-medium bg-[var(--fp-accent)] text-[var(--fp-accent-on)] hover:bg-[var(--fp-accent-hover)] rounded-[6px]"
                        size="sm"
                        type="submit"
                      >
                        Go
                      </Button>
                      <Button
                        className="h-7 px-2 text-[11px] shrink-0 font-medium text-[var(--fp-text-secondary)] hover:text-[var(--fp-text-primary)] hover:bg-[var(--fp-surface-hover)] rounded-[6px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditingPath();
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center min-w-0 h-full flex-1 overflow-hidden">
                      <nav
                        aria-label="Current path"
                        className="flex items-center min-w-0 h-full"
                      >
                        {visibleTabs.displayed.map((tab, idx) => {
                          const isActive = tab.path === currentPath;
                          const isRoot = tab.isRoot;
                          const isDrive = tab.isDrive;

                          const showDropdownBefore =
                            visibleTabs.collapsed.length > 0 && idx === 1;

                          const prevTab =
                            idx > 0
                              ? visibleTabs.displayed[idx - 1]
                              : undefined;
                          const prevWasActive = prevTab
                            ? prevTab.path === currentPath
                            : false;
                          const showDivider =
                            idx > 0 && !isActive && !prevWasActive;

                          return (
                            <div
                              className="flex items-center h-full shrink min-w-0"
                              key={tab.path}
                            >
                              {showDropdownBefore && (
                                <div className="flex items-center h-full shrink-0">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        aria-label="More folders"
                                        className="fp-loc-tab fp-loc-tab-inactive px-2 h-8 rounded-[8px] shrink-0 mr-1"
                                        type="button"
                                      >
                                        <span className="font-semibold text-xs">
                                          …
                                        </span>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="start"
                                      className="border-[var(--fp-border-control)] bg-[var(--fp-surface-modal)] shadow-2xl z-[120] rounded-[8px] p-1.5 min-w-[180px]"
                                    >
                                      {visibleTabs.collapsed.map((colTab) => (
                                        <DropdownMenuItem
                                          className="cursor-pointer text-xs rounded-[5px] text-[var(--fp-text-secondary)] hover:text-[var(--fp-text-primary)] hover:bg-[var(--fp-surface-hover)] focus:bg-[var(--fp-surface-hover)] focus:text-[var(--fp-text-primary)] px-2.5 py-1.5 flex items-center gap-2"
                                          key={colTab.path}
                                          onClick={() =>
                                            loadDirectory(colTab.path, true)
                                          }
                                        >
                                          {colTab.isDrive ? (
                                            <FluentHardDrive className="size-3.5 text-[var(--fp-drive)] shrink-0" />
                                          ) : (
                                            <FluentFolder className="size-3.5 text-[var(--fp-folder)] shrink-0" />
                                          )}
                                          <span className="truncate">
                                            {colTab.isRoot
                                              ? getRootLabel()
                                              : colTab.name}
                                          </span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}

                              {showDivider && !showDropdownBefore && (
                                <div
                                  aria-hidden="true"
                                  className="fp-tab-divider"
                                />
                              )}

                              <button
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                  "fp-loc-tab",
                                  isActive
                                    ? "fp-loc-tab-active"
                                    : "fp-loc-tab-inactive"
                                )}
                                onClick={() => loadDirectory(tab.path, true)}
                                title={tab.path}
                                type="button"
                              >
                                {isRoot ? (
                                  <FluentDesktop
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      isActive
                                        ? "text-[var(--fp-text-primary)]"
                                        : "text-[var(--fp-text-secondary)]"
                                    )}
                                  />
                                ) : isDrive ? (
                                  <FluentHardDrive
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      isActive
                                        ? "text-[var(--fp-text-primary)]"
                                        : "text-[var(--fp-text-secondary)]"
                                    )}
                                  />
                                ) : (
                                  <FluentFolder
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      "text-[var(--fp-folder)]"
                                    )}
                                  />
                                )}
                                <span className="truncate">
                                  {tab.isRoot ? getRootLabel() : tab.name}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </nav>

                      {/* Click-to-edit whitespace area */}
                      <div
                        className="flex-1 min-w-[24px] h-full cursor-text"
                        onClick={startEditingPath}
                        title="Click to edit path"
                      />
                    </div>
                  )}
                </div>

                {/* Search Input Field (clamp 220 to 320px) */}
                <div className="relative flex items-center w-[clamp(220px,24vw,320px)] shrink-0 h-10 rounded-[10px] border border-[var(--fp-border-control)] bg-[var(--fp-surface-control)] px-3">
                  {isSearching ? (
                    <FluentRefresh className="size-3.5 text-[var(--fp-accent-ink)] shrink-0 mr-2 animate-spin" />
                  ) : (
                    <FluentSearch className="size-3.5 text-[var(--fp-text-secondary)] shrink-0 mr-2" />
                  )}
                  <input
                    aria-label="Search directory"
                    className="h-full w-full border-none bg-transparent text-xs text-[var(--fp-text-primary)] placeholder:text-[var(--fp-text-tertiary)] focus:outline-none focus:ring-0 p-0"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                  />
                  {searchQuery && (
                    <button
                      aria-label="Clear search"
                      className="text-[var(--fp-text-tertiary)] hover:text-[var(--fp-text-primary)] p-0.5 ml-1"
                      onClick={() => setSearchQuery("")}
                      type="button"
                    >
                      <FluentDismiss className="size-3" />
                    </button>
                  )}
                </div>

                {/* 1px Vertical Divider */}
                <div
                  aria-hidden="true"
                  className="h-5 w-[1px] bg-[var(--fp-hairline)] shrink-0"
                />

                {/* Quiet Close Button (36px hit area) */}
                <DialogPrimitive.Close asChild>
                  <Button
                    aria-label="Close dialog"
                    className="size-9 rounded-[8px] text-[var(--fp-text-secondary)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text-primary)] transition-ui motion-fast shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    size="icon"
                    variant="ghost"
                  >
                    <FluentDismiss className="size-4" />
                  </Button>
                </DialogPrimitive.Close>
              </div>

              {/* Row 2: Hidden Folders Switch Toggle + New Folder Button */}
              <div className="flex items-center">
                {/* Real Switch Toggle for Hidden Folders */}
                <button
                  aria-checked={showHidden}
                  aria-label="Toggle hidden folders"
                  className="group flex items-center gap-2 cursor-pointer outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)] rounded-full"
                  onClick={() => setShowHidden((prev) => !prev)}
                  role="switch"
                  type="button"
                >
                  <div
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                      showHidden
                        ? "bg-[var(--fp-accent)]"
                        : "bg-[var(--fp-surface-active)] group-hover:bg-[var(--fp-hairline-bright)]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-3.5 rounded-full bg-[var(--fp-text-primary)] shadow-xs transition-transform",
                        showHidden ? "translate-x-[18px]" : "translate-x-[2px]"
                      )}
                    />
                  </div>
                  <span className="text-xs text-[var(--fp-text-secondary)] group-hover:text-[var(--fp-text-primary)] transition-colors select-none font-medium">
                    Hidden Folders
                  </span>
                </button>

                {/* Vertical Hairline Divider */}
                <div className="h-4 w-[1px] bg-[var(--fp-hairline)] mx-3" />

                {/* New Folder Action Button */}
                <Button
                  aria-label="New folder"
                  className={cn(
                    "h-7 gap-1.5 px-2.5 text-xs font-medium rounded-[5px] border border-transparent transition-ui motion-fast focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]",
                    currentPath === "THIS_PC" || loading
                      ? "text-[var(--fp-btn-disabled-fg)] opacity-40 cursor-not-allowed pointer-events-none"
                      : "text-[var(--fp-text-secondary)] hover:text-[var(--fp-text-primary)] hover:bg-[var(--fp-surface-hover)]"
                  )}
                  disabled={currentPath === "THIS_PC" || loading}
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setNewFolderName("");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <FluentFolderAdd className="size-4" />
                  <span>New Folder</span>
                </Button>

                {/* Mac Native Path Picker */}
                <MacNativePathPicker
                  defaultPath={currentPath}
                  directory={!isFileMode}
                  disabled={!open}
                  onError={setError}
                  onSelect={async (path) => {
                    if (openRef.current) {
                      await confirmSelection(path, isFileMode);
                    }
                  }}
                  title={title}
                />
              </div>
            </div>

            {/* Three-Pane Hierarchy: DRIVES rail | FOLDERS pane | PREVIEW pane */}
            <div className="fp-three-panes">
              {/* Pane 1: DRIVES Rail (Left) */}
              <aside aria-label="System drives" className="fp-drives-rail">
                <div className="flex shrink-0 items-center px-4 py-2 border-b border-[var(--fp-hairline)] fp-font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--fp-text-tertiary)] select-none">
                  DRIVES
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredDrives.map((drive, idx) => {
                    const active = isLocationActive(
                      drive.path,
                      currentPath,
                      drivesList.map((d) => d.path)
                    );
                    const isFocused = focusedDriveIndex === idx;
                    return (
                      <button
                        className={cn(
                          "fp-drive-item text-left w-full focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]",
                          active && "fp-drive-active"
                        )}
                        key={drive.path}
                        onClick={() => loadDirectory(drive.path, true)}
                        onKeyDown={(e) => handleDriveKeyDown(e, idx)}
                        ref={(el) => {
                          driveItemRefs.current[idx] = el;
                        }}
                        tabIndex={isFocused ? 0 : -1}
                        title={
                          WINDOWS_DRIVE_RE.test(drive.path)
                            ? `${drive.label} (${drive.letter})`
                            : `${drive.letter} — ${drive.label}`
                        }
                        type="button"
                      >
                        <FluentHardDrive
                          className={cn(
                            "size-4.5 shrink-0 transition-colors",
                            active
                              ? "text-[var(--fp-text-primary)]"
                              : "text-[var(--fp-text-secondary)]"
                          )}
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            className={cn(
                              "fp-font-mono text-xs font-semibold leading-tight",
                              active
                                ? "text-[var(--fp-text-primary)]"
                                : "text-[var(--fp-text-primary)]"
                            )}
                          >
                            {drive.letter}
                          </span>
                          <span className="text-[11px] text-[var(--fp-text-secondary)] leading-tight truncate mt-0.5">
                            {drive.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredDrives.length === 0 && (
                    <div className="px-3 py-4 text-xs text-[var(--fp-text-tertiary)] text-center">
                      No matching drives
                    </div>
                  )}
                </div>
              </aside>

              {/* Pane 2: FOLDERS Pane (Middle) */}
              <main
                aria-label={isFileMode ? "File list" : "Folder list"}
                className="fp-folders-pane"
              >
                {/* Column Headers */}
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--fp-hairline)] px-4 py-2 fp-font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--fp-text-tertiary)] select-none">
                  <span className="truncate pr-2">
                    {currentPath === "THIS_PC"
                      ? "THIS PC"
                      : `FOLDERS (${currentPath})`}
                  </span>
                  {currentPath !== "THIS_PC" && (
                    <span className="shrink-0 text-right">MODIFIED</span>
                  )}
                </div>

                {/* Content Area / List View */}
                <section
                  aria-busy={loading}
                  className="relative flex-1 min-h-0 overflow-y-auto px-2 py-1 fp-scroll-fade"
                  ref={listRef}
                >
                  <ErrorBoundary
                    fallback={
                      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                        <FluentAlert className="size-8 text-[var(--fp-accent-ink)]" />
                        <p className="mt-3 text-xs text-[var(--fp-text-secondary)]">
                          Failed to render directory contents.
                        </p>
                        <Button
                          className="mt-3 h-7 text-xs bg-[var(--fp-accent)] text-[var(--fp-accent-on)] hover:bg-[var(--fp-accent-hover)]"
                          onClick={() => loadDirectory(currentPath, false)}
                          size="sm"
                        >
                          Reload
                        </Button>
                      </div>
                    }
                  >
                    {/* Inline New Folder Input */}
                    {isCreatingFolder && (
                      <form
                        className="flex items-center gap-2.5 h-9 px-3 my-0.5 rounded-[6px] bg-[var(--fp-surface-hover)] border border-[var(--fp-accent-border)]"
                        onSubmit={handleCreateFolderSubmit}
                      >
                        <FluentFolder className="size-4 text-[var(--fp-folder)] shrink-0" />
                        <input
                          aria-label="New folder name"
                          className="flex-1 min-w-0 bg-transparent text-xs text-[var(--fp-text-primary)] focus:outline-none placeholder:text-[var(--fp-text-tertiary)]"
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setIsCreatingFolder(false);
                            }
                          }}
                          placeholder="New Folder"
                          ref={newFolderInputRef}
                          type="text"
                          value={newFolderName}
                        />
                        <button
                          className="text-xs font-medium text-[var(--fp-accent-ink)] hover:underline shrink-0"
                          type="submit"
                        >
                          Create
                        </button>
                        <button
                          className="text-xs text-[var(--fp-text-tertiary)] hover:text-[var(--fp-text-primary)] shrink-0"
                          onClick={() => setIsCreatingFolder(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {/* THIS PC view when rail is NOT collapsed */}
                    {currentPath === "THIS_PC" && !isRailCollapsed ? (
                      searchQuery.trim().length > 0 &&
                      filteredDrives.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center select-none p-6">
                          <FluentHardDrive className="size-8 text-[var(--fp-text-tertiary)] opacity-60" />
                          <span className="mt-2 text-xs text-[var(--fp-text-secondary)] font-medium">
                            No matching drives
                          </span>
                        </div>
                      ) : (
                        <div className="fp-watermark-container">
                          <MarshallLogoMark className="fp-watermark-logo" />
                          <span className="sr-only">
                            Select a drive to begin
                          </span>
                        </div>
                      )
                    ) : (
                      <>
                        {/* Empty State */}
                        {!loading && displayItems.length === 0 && !error && (
                          <div className="flex h-48 flex-col items-center justify-center text-center select-none">
                            <FluentFolder className="size-8 text-[var(--fp-text-tertiary)] opacity-60" />
                            <span className="mt-2 text-xs text-[var(--fp-text-secondary)] font-medium">
                              {isSearchActive
                                ? `No matches found for "${searchQuery}"`
                                : isFileMode
                                  ? "This folder contains no files."
                                  : "This folder is empty."}
                            </span>
                          </div>
                        )}

                        {/* Error State */}
                        {error && (
                          <div className="flex h-48 flex-col items-center justify-center p-6 text-center select-none">
                            <FluentAlert className="size-7 text-[var(--fp-accent-ink)]" />
                            <span className="mt-2 text-xs font-medium text-[var(--fp-text-primary)]">
                              Failed to read directory
                            </span>
                            <span className="mt-1 max-w-sm text-[11px] text-[var(--fp-text-tertiary)] truncate">
                              {error}
                            </span>
                            <Button
                              className="mt-3 h-7 px-3 text-xs bg-[var(--fp-accent)] text-[var(--fp-accent-on)] hover:bg-[var(--fp-accent-hover)] rounded-[5px]"
                              onClick={() => loadDirectory(currentPath, false)}
                              size="sm"
                            >
                              Retry
                            </Button>
                          </div>
                        )}

                        {/* Items List (36px rows) */}
                        <div className="space-y-0.5">
                          {displayItems.map((item, idx) => {
                            const isSelected =
                              selectedFolderPath === item.path ||
                              selectedIndex === idx;
                            const isDrive = item.isDrive;
                            const Glyph = getFolderGlyph(
                              item.name,
                              item.isDir,
                              item.isDrive,
                              item.isHidden,
                              isFileMode
                            );

                            return (
                              <div
                                className={cn(
                                  "group relative flex cursor-pointer items-center justify-between rounded-[6px] border border-transparent transition-colors select-none h-9 px-2.5",
                                  isSelected
                                    ? "fp-row-selected"
                                    : "hover:bg-[var(--fp-surface-hover)] text-[var(--fp-text-primary)]"
                                )}
                                data-folder-item=""
                                data-selected={isSelected}
                                key={item.path}
                                onClick={() => handleItemClick(item, idx)}
                                onDoubleClick={() =>
                                  handleItemDoubleClick(item)
                                }
                              >
                                {/* Left: Icon + Name */}
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-4">
                                  {isDrive ? (
                                    <FluentHardDrive className="size-4.5 text-[var(--fp-drive)] shrink-0" />
                                  ) : (
                                    <Glyph
                                      className={cn(
                                        "size-4 shrink-0 transition-colors",
                                        "text-[var(--fp-folder)]"
                                      )}
                                    />
                                  )}

                                  <span
                                    className={cn(
                                      "truncate text-xs",
                                      isSelected
                                        ? "font-semibold text-[var(--fp-text-primary)]"
                                        : "font-normal text-[var(--fp-text-primary)]"
                                    )}
                                    title={item.name}
                                  >
                                    {isDrive
                                      ? normalizeDriveDisplayName(
                                          item.name,
                                          item.path
                                        )
                                      : item.name}
                                  </span>
                                </div>

                                {/* Right: Modified Date / Drive Root */}
                                <span
                                  className={cn(
                                    "w-28 shrink-0 text-right fp-font-mono text-xs tabular-nums",
                                    isSelected
                                      ? "text-[var(--fp-text-primary)]"
                                      : "text-[var(--fp-text-tertiary)] group-hover:text-[var(--fp-text-secondary)]"
                                  )}
                                >
                                  {isDrive
                                    ? "Drive Root"
                                    : formatDate(item.modifiedAt)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </ErrorBoundary>
                </section>
              </main>

              {/* Pane 3: PREVIEW Pane (Right) */}
              <aside aria-label="Folder preview" className="fp-preview-pane">
                <div className="flex shrink-0 items-center px-4 py-2 border-b border-[var(--fp-hairline)] fp-font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--fp-text-tertiary)] select-none">
                  PREVIEW
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-start">
                  {!selectedItem || selectedFolderPath === "THIS_PC" ? (
                    /* Empty State: Quiet outline folder icon */
                    <div className="flex flex-1 flex-col items-center justify-center text-center p-4 select-none my-auto">
                      <FluentFolder className="size-12 text-[var(--fp-text-tertiary)] opacity-40 mb-3" />
                      <span className="text-xs text-[var(--fp-text-secondary)] leading-relaxed max-w-[200px]">
                        Select a folder to preview its contents
                      </span>
                    </div>
                  ) : (
                    /* Active Folder Preview Card */
                    <div className="flex flex-col fp-preview-content">
                      {/* Top: Folder Icon, Name, Path, Date */}
                      <div className="flex flex-col items-center text-center pb-4 border-b border-[var(--fp-hairline)]">
                        <div
                          className={cn(
                            "flex size-12 items-center justify-center rounded-[10px] border mb-2.5",
                            selectedItem.isDrive
                              ? "border-[var(--fp-accent-border)] bg-[var(--fp-accent-tint)] text-[var(--fp-accent-ink)]"
                              : "border-[var(--fp-folder-border)] bg-[var(--fp-folder-tint)] text-[var(--fp-folder)]"
                          )}
                        >
                          {selectedItem.isDrive ? (
                            <FluentHardDrive className="size-6" />
                          ) : (
                            <FluentFolderOpen className="size-6" />
                          )}
                        </div>
                        <h3
                          className="fp-font-sans text-sm font-semibold text-[var(--fp-text-primary)] truncate max-w-full"
                          title={selectedItem.name}
                        >
                          {selectedItem.isDrive
                            ? normalizeDriveDisplayName(
                                selectedItem.name,
                                selectedItem.path
                              )
                            : selectedItem.name}
                        </h3>
                        <span
                          className="fp-font-mono text-[11px] text-[var(--fp-text-tertiary)] truncate max-w-full mt-1"
                          title={selectedItem.path}
                        >
                          {selectedItem.path}
                        </span>
                        <span className="fp-font-mono text-[10.5px] text-[var(--fp-text-secondary)] mt-1.5">
                          {selectedItem.isDrive
                            ? "Drive Root"
                            : formatDate(selectedItem.modifiedAt)}
                        </span>
                      </div>

                      {/* Bottom: Child Folders Listing */}
                      <div className="pt-3 flex flex-col">
                        <span className="fp-font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--fp-text-tertiary)] mb-2 select-none">
                          {previewLoading
                            ? "Reading contents…"
                            : `${previewItems.length} ${
                                previewItems.length === 1 ? "folder" : "folders"
                              }`}
                        </span>

                        {previewLoading && (
                          <div className="space-y-2 py-1">
                            <div className="h-6 w-full fp-skeleton animate-pulse" />
                            <div className="h-6 w-4/5 fp-skeleton animate-pulse" />
                            <div className="h-6 w-3/4 fp-skeleton animate-pulse" />
                          </div>
                        )}

                        {!previewLoading && previewError && (
                          <span className="text-[11px] text-[var(--fp-text-tertiary)] italic py-2">
                            Unable to read folder contents
                          </span>
                        )}

                        {!(previewLoading || previewError) &&
                          previewItems.length === 0 && (
                            <span className="text-[11px] text-[var(--fp-text-tertiary)] italic py-2">
                              This folder is empty
                            </span>
                          )}

                        {!(previewLoading || previewError) &&
                          previewItems.length > 0 && (
                            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                              {previewItems.slice(0, 40).map((child) => (
                                <div
                                  className="flex items-center gap-2 py-1 px-1.5 rounded-[4px] text-xs text-[var(--fp-text-primary)] hover:bg-[var(--fp-surface-hover)] truncate select-none"
                                  key={child.path}
                                  title={child.name}
                                >
                                  <FluentFolder className="size-3.5 text-[var(--fp-folder)] shrink-0" />
                                  <span className="truncate">{child.name}</span>
                                </div>
                              ))}
                              {previewItems.length > 40 && (
                                <span className="fp-font-mono text-[11px] text-[var(--fp-text-tertiary)] pl-2 pt-1 block">
                                  +{previewItems.length - 40} more
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {/* Footer Action Bar */}
            <div className="flex shrink-0 items-center justify-between border-t border-[var(--fp-hairline)] bg-[var(--fp-surface-modal)] p-3 px-5">
              <div className="flex flex-col min-w-0 flex-1 pr-4">
                <span className="fp-font-mono text-[10px] text-[var(--fp-text-tertiary)] uppercase tracking-[0.08em] select-none">
                  {isFileMode ? "SELECTED FILE" : "WORKING DIRECTORY"}
                </span>
                <div
                  className="mt-1 flex items-center min-w-0 max-w-[480px] bg-[var(--fp-surface-control)] border border-[var(--fp-border-control)] rounded-[6px] px-3 py-1.5 fp-font-mono text-xs overflow-hidden"
                  title={
                    selectedFolderPath === "THIS_PC"
                      ? getRootLabel()
                      : selectedFolderPath
                  }
                >
                  {renderFooterPath(selectedFolderPath)}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <DialogPrimitive.Close asChild>
                  <Button
                    className="h-9 px-4 text-xs font-medium text-[var(--fp-text-secondary)] hover:text-[var(--fp-text-primary)] hover:bg-[var(--fp-surface-hover)] border border-transparent rounded-[8px] transition-ui motion-fast focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </DialogPrimitive.Close>
                <Button
                  className={cn(
                    "h-9 gap-1.5 px-4 text-xs font-semibold rounded-[8px] transition-ui motion-fast active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--fp-accent)]",
                    !selectedFolderPath ||
                      selectedFolderPath === "THIS_PC" ||
                      loading ||
                      (isFileMode && !selectedIsFile)
                      ? "bg-[var(--fp-btn-disabled-bg)] text-[var(--fp-btn-disabled-fg)] border border-[var(--fp-btn-disabled-border)] shadow-none opacity-100 cursor-not-allowed pointer-events-none"
                      : "bg-[var(--fp-accent)] text-[var(--fp-accent-on)] hover:bg-[var(--fp-accent-hover)] active:bg-[var(--fp-accent-active)] border border-transparent shadow-xs"
                  )}
                  disabled={
                    !selectedFolderPath ||
                    selectedFolderPath === "THIS_PC" ||
                    loading ||
                    (isFileMode && !selectedIsFile)
                  }
                  onClick={() =>
                    confirmSelection(selectedFolderPath, selectedIsFile)
                  }
                >
                  <FluentCheckmark
                    className={cn(
                      "size-4",
                      !selectedFolderPath ||
                        selectedFolderPath === "THIS_PC" ||
                        loading ||
                        (isFileMode && !selectedIsFile)
                        ? "text-[var(--fp-btn-disabled-fg)]"
                        : "text-[var(--fp-text-primary)]"
                    )}
                  />
                  <span>{isFileMode ? "Select File" : "Select Folder"}</span>
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
