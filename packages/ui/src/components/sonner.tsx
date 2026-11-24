"use client";

import { Loader2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import "./sonner.css";

// Leave three seconds to read after the full entrance finishes.
const DEFAULT_TOAST_DURATION_MS = 4500;

/** Inline vector mark: always crisp, tinted by `currentColor` per theme. */
function MarshellMark() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="467,104 283,235 283,182 214,232 213,231 218,119 167,194 132,250 84,333 45,406 215,269 217,270 219,344 304,283 306,284 300,403" />
    </svg>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group marshell-toaster"
      closeButton
      duration={DEFAULT_TOAST_DURATION_MS}
      icons={{
        success: <MarshellMark />,
        info: <MarshellMark />,
        warning: <MarshellMark />,
        error: <MarshellMark />,
        loading: <Loader2Icon className="animate-spin" />,
      }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 48px)",
        left: 12,
        right: 12,
      }}
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      position="top-center"
      style={
        {
          "--normal-bg": "transparent",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          // Never wider than the window, identical on every OS and DPI.
          "--width": "min(380px, calc(100vw - 24px))",
          "--toast-duration": `${DEFAULT_TOAST_DURATION_MS}ms`,
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        duration: DEFAULT_TOAST_DURATION_MS,
        closeButton: true,
        closeButtonAriaLabel: "Dismiss notification",
        unstyled: true,
        classNames: {
          toast: "marshell-toast font-sans",
          content: "marshell-toast-content",
          icon: "marshell-toast-status",
          title: "marshell-toast-title",
          description: "marshell-toast-description",
          closeButton: "marshell-toast-close",
          actionButton: "marshell-toast-action",
          cancelButton: "marshell-toast-cancel",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
