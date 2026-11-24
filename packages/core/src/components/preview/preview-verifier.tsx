"use client";

import {
  appCommand,
  isTrustedMessage,
  parsePreviewMessage,
} from "@workspace/core/lib/preview-bridge";
import { previewClient } from "@workspace/core/lib/preview-client";
import { usePreviewVerificationStore } from "@workspace/core/stores/preview-verification-store";
import { useEffect, useRef, useState } from "react";

/**
 * Headless, always-mounted counterpart to PreviewBrowser: loads a page in an
 * off-screen iframe so delegated UI work can be verified to actually run, whether or
 * not the user has the visible Preview tab open (that one only mounts once visited).
 */
export function PreviewVerifier({ workspaceId }: { workspaceId: string }) {
  const [frame, setFrame] = useState<{
    nonce: string;
    origin: string;
    path: string;
  } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const check = usePreviewVerificationStore((s) => s.checks[workspaceId]);

  useEffect(() => {
    if (check?.status !== "pending" || frame?.nonce === check.nonce) {
      return;
    }
    let cancelled = false;
    previewClient
      .proxyStart(check.port)
      .then((origin) => {
        if (!cancelled) {
          setFrame({ nonce: check.nonce, origin, path: check.path });
        }
      })
      .catch(() => {
        if (!cancelled) {
          usePreviewVerificationStore
            .getState()
            .markTimedOut(workspaceId, check.nonce);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [check, frame, workspaceId]);

  useEffect(() => {
    if (!frame) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (
        !isTrustedMessage(event, frameRef.current?.contentWindow, frame.origin)
      ) {
        return;
      }
      const parsed = parsePreviewMessage(event.data);
      if (!parsed) {
        return;
      }
      if (parsed.kind === "navigation") {
        usePreviewVerificationStore
          .getState()
          .markLoaded(workspaceId, frame.nonce, parsed.state.url);
      } else if (parsed.kind === "runtime-error") {
        usePreviewVerificationStore
          .getState()
          .addError(workspaceId, frame.nonce, parsed.payload);
      } else if (parsed.kind === "page-snapshot") {
        usePreviewVerificationStore
          .getState()
          .setSnapshot(workspaceId, frame.nonce, parsed.snapshot);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, workspaceId]);

  useEffect(() => {
    if (!frame || check?.nonce !== frame.nonce || check.status !== "loaded") {
      return;
    }
    const timer = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage(
        appCommand("inspect-page"),
        frame.origin
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [frame, check?.nonce, check?.status]);

  // The tool owns the timeout and clears its check after collecting errors.
  // A fixed frame timer used to abort slow page loads and restart pending checks.
  if (!frame || check?.nonce !== frame.nonce) {
    return null;
  }

  return (
    <iframe
      key={frame.nonce}
      ref={frameRef}
      sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
      src={`${frame.origin}${frame.path}`}
      style={{
        height: 720,
        left: -9999,
        opacity: 0,
        pointerEvents: "none",
        position: "fixed",
        top: -9999,
        width: 1280,
      }}
      title="Automated preview check"
    />
  );
}
