"use client";

import { SettingsView } from "@workspace/core/components/settings/settings-dialog";

export function SettingsPage() {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-transparent p-2 sm:p-5 md:p-6">
      <div className="flex h-full max-h-[880px] w-full max-w-[1260px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <SettingsView />
      </div>
    </div>
  );
}
