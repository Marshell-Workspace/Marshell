"use client";

import type { ReactNode } from "react";

const ROW_CLASS =
  "flex items-center justify-between gap-6 border-b border-border py-3.5 last:border-b-0";

export function SettingRow({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={ROW_CLASS}>
      <div className="min-w-0 flex-1 space-y-1">
        <label className="font-medium text-sm text-foreground" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p
            className="text-muted-foreground text-xs leading-relaxed"
            id={`${id}-description`}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Small uppercase group title shared by the settings pages. */
export function SettingsSectionHeading({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h3
      className="font-medium text-muted-foreground text-xs uppercase tracking-wider"
      id={id}
    >
      {children}
    </h3>
  );
}

/** A read-only row: label on the left, a value or action on the right. */
export function SettingsInfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={ROW_CLASS}>
      <span className="font-medium text-sm text-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-3 text-sm">{children}</div>
    </div>
  );
}

/** A list entry: title and optional detail lines on the left, action on the right. */
export function SettingsListRow({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={ROW_CLASS}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-sm text-foreground">{title}</p>
        {children ? (
          <div className="space-y-0.5 text-muted-foreground text-xs">
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
