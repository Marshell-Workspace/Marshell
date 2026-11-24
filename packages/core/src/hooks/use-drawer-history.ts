"use client";

import { useEffect, useRef } from "react";

export function useDrawerHistory(
  isOpen: boolean,
  onOpenChange: (open: boolean) => void
) {
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isPushed = false;
    window.history.pushState({ drawer: "open" }, "");
    isPushed = true;

    const handlePopState = () => {
      onOpenChangeRef.current(false);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (isPushed && window.history.state?.drawer === "open") {
        window.history.back();
      }
    };
  }, [isOpen]);
}
