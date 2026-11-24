"use client";

import { Button } from "@workspace/ui/components/button";
import { FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function isNativeMac(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) &&
    typeof navigator !== "undefined" &&
    /Macintosh|MacIntel|MacPPC|Mac68K/i.test(navigator.userAgent)
  );
}

/** A native user selection grants intent for that path; it never runs on mount. */
export function MacNativePathPicker({
  directory,
  defaultPath,
  disabled = false,
  title,
  onSelect,
  onError,
}: {
  directory: boolean;
  defaultPath?: string;
  disabled?: boolean;
  title: string;
  onSelect: (path: string) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const enabledRef = useRef(!disabled);
  enabledRef.current = !disabled;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const choose = async () => {
    if (pendingRef.current || !enabledRef.current || !isNativeMac()) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      // The parent may close while the plugin is loading.
      if (!(mountedRef.current && enabledRef.current)) {
        return;
      }
      const selected = await open({
        title,
        directory,
        multiple: false,
        recursive: directory,
        ...(defaultPath && defaultPath !== "THIS_PC" ? { defaultPath } : {}),
      });
      if (
        typeof selected === "string" &&
        mountedRef.current &&
        enabledRef.current
      ) {
        await onSelect(selected);
      }
    } catch (error) {
      if (mountedRef.current && enabledRef.current) {
        onError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) {
        setPending(false);
      }
    }
  };

  if (!isNativeMac()) {
    return null;
  }
  return (
    <Button
      aria-label="Choose in Finder"
      className="h-7.5 gap-1.5 rounded-md border border-border bg-background px-2.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
      disabled={disabled || pending}
      onClick={choose}
      size="sm"
      type="button"
      variant="ghost"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FolderOpen className="size-3.5" />
      )}
      <span>Choose in Finder…</span>
    </Button>
  );
}
