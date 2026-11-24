"use client";

import { getDesktopClient } from "@workspace/core/lib/desktop-client";
import { useTranslations } from "@workspace/i18n";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useRef, useState } from "react";

/** No access reset or OS permission request happens until the button is clicked. */
export function KeychainAccessCard({ onReset }: { onReset?: () => void }) {
  const t = useTranslations("KeychainAccess");
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"ready" | "failed" | null>(null);
  const flight = useRef(false);
  useEffect(() => {
    let active = true;
    getDesktopClient()
      .then((client) => {
        if (active) {
          setAvailable(client.platform === "darwin");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const retry = async () => {
    if (flight.current) {
      return;
    }
    flight.current = true;
    setPending(true);
    setStatus(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("secure_retry_access");
      setStatus("ready");
      onReset?.();
    } catch {
      setStatus("failed");
    } finally {
      flight.current = false;
      setPending(false);
    }
  };
  if (!available) {
    return null;
  }
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 text-left">
      <h3 className="font-medium text-sm">{t("title")}</h3>
      <p className="text-muted-foreground text-xs">{t("description")}</p>
      <Button disabled={pending} onClick={retry} size="sm" variant="outline">
        {t(pending ? "resetting" : "retry")}
      </Button>
      {status ? (
        <p className="text-xs" role={status === "failed" ? "alert" : "status"}>
          {t(status)}
        </p>
      ) : null}
    </section>
  );
}
