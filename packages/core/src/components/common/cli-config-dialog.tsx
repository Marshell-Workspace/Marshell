"use client";

import { AiCliLogo } from "@workspace/core/components/common/ai-cli-logos";
import type { CliItemMeta } from "@workspace/core/lib/cli-catalog";
import {
  buildCliInvocation,
  CLI_CONFIG_DEFS,
  type CliPermissionOption,
  type CliUserRuntimeConfig,
} from "@workspace/core/lib/cli-config-catalog";
import type { CliItemStatus } from "@workspace/core/lib/cli-installer-client";
import { useCliSettingsStore } from "@workspace/core/stores/cli-settings-store";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  Info,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";

interface CliConfigDialogProps {
  agent: CliItemMeta | null;
  isDetecting?: boolean;
  onInstallRequest?: (agent: CliItemMeta) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  statusObj?: CliItemStatus;
}

export function CliConfigDialog({
  open,
  onOpenChange,
  agent,
  statusObj,
  isDetecting = false,
  onInstallRequest,
}: CliConfigDialogProps) {
  const getConfig = useCliSettingsStore((s) => s.getConfig);
  const saveConfig = useCliSettingsStore((s) => s.saveConfig);
  const resetConfig = useCliSettingsStore((s) => s.resetConfig);

  const [draftConfig, setDraftConfig] = useState<CliUserRuntimeConfig>({
    modeId: "default",
    enabledPermissions: [],
    advancedFlagValues: {},
    customArgs: "",
  });

  const [confirmingDangerousPerm, setConfirmingDangerousPerm] =
    useState<CliPermissionOption | null>(null);

  const [copiedPreview, setCopiedPreview] = useState(false);

  // Initialize draft config from store whenever dialog opens or agent changes
  useEffect(() => {
    if (agent && open) {
      const stored = getConfig(agent.id);
      setDraftConfig({
        modeId: stored.modeId || "default",
        enabledPermissions: stored.enabledPermissions
          ? [...stored.enabledPermissions]
          : [],
        advancedFlagValues: stored.advancedFlagValues
          ? { ...stored.advancedFlagValues }
          : {},
        customArgs: stored.customArgs || "",
      });
      setConfirmingDangerousPerm(null);
    }
  }, [agent, open, getConfig]);

  if (!agent) {
    return null;
  }

  const providerDef = CLI_CONFIG_DEFS[agent.id] ||
    CLI_CONFIG_DEFS[agent.id.toLowerCase()] || {
      id: agent.id,
      name: agent.name,
      executable: agent.execName || agent.command,
      description: agent.description,
      defaultModeId: "default",
      executionModes: [],
      permissionOptions: [],
      advancedFlags: [],
    };

  const isInstalled =
    statusObj?.status === "installed" ||
    (statusObj as unknown as { installed?: boolean })?.installed === true;

  const preview = buildCliInvocation(agent.id, draftConfig);

  const handleModeChange = (modeId: string) => {
    setDraftConfig((prev) => ({ ...prev, modeId }));
  };

  const handleTogglePermission = (perm: CliPermissionOption) => {
    const isCurrentlyEnabled =
      draftConfig.enabledPermissions?.includes(perm.id) ?? false;

    if (isCurrentlyEnabled) {
      setDraftConfig((prev) => ({
        ...prev,
        enabledPermissions: (prev.enabledPermissions || []).filter(
          (id) => id !== perm.id
        ),
      }));
    } else {
      if (perm.isDangerous) {
        setConfirmingDangerousPerm(perm);
        return;
      }
      setDraftConfig((prev) => ({
        ...prev,
        enabledPermissions: [...(prev.enabledPermissions || []), perm.id],
      }));
    }
  };

  const handleConfirmDangerous = (perm: CliPermissionOption) => {
    setDraftConfig((prev) => ({
      ...prev,
      enabledPermissions: [...(prev.enabledPermissions || []), perm.id],
    }));
    setConfirmingDangerousPerm(null);
  };

  const handleAdvancedBooleanToggle = (flagId: string) => {
    setDraftConfig((prev) => {
      const current = prev.advancedFlagValues?.[flagId] === true;
      return {
        ...prev,
        advancedFlagValues: {
          ...(prev.advancedFlagValues || {}),
          [flagId]: !current,
        },
      };
    });
  };

  const handleAdvancedStringChange = (flagId: string, val: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      advancedFlagValues: {
        ...(prev.advancedFlagValues || {}),
        [flagId]: val,
      },
    }));
  };

  const handleSave = () => {
    saveConfig(agent.id, draftConfig);
    onOpenChange(false);
  };

  const handleReset = () => {
    resetConfig(agent.id);
    setDraftConfig({
      modeId: providerDef.defaultModeId || "default",
      enabledPermissions: [],
      advancedFlagValues: {},
      customArgs: "",
    });
  };

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(preview.commandString);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 1500);
  };

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent
          className="max-w-[560px] gap-0 overflow-hidden border border-border bg-popover p-0 shadow-xl rounded-2xl"
          onEscapeKeyDown={(e) => {
            e.stopPropagation();
          }}
          onInteractOutside={(e) => {
            e.stopPropagation();
          }}
          onPointerDownOutside={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <DialogHeader className="flex-shrink-0 border-b border-border bg-card px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border p-1.5 text-foreground">
                <AiCliLogo className="size-full object-contain" id={agent.id} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display font-semibold text-foreground text-base tracking-tight flex items-center gap-2">
                  <span>{agent.name}</span>
                  <span className="font-mono text-[11px] font-normal text-subtle bg-secondary px-2 py-0.5 rounded-md border border-border">
                    {providerDef.executable}
                  </span>
                </DialogTitle>
                <DialogDescription className="font-sans text-muted-foreground text-xs mt-0.5">
                  {isInstalled
                    ? "Configure execution modes, runtime permissions, and launch flags."
                    : `Install ${agent.name} to configure its options.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Main Body */}
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto subtle-scrollbar">
            {/* Case 1: Checking status */}
            {isDetecting && !statusObj ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="size-6 border-2 border-border border-t-white rounded-full animate-spin" />
                <p className="font-sans text-sm text-muted-foreground">
                  Checking {agent.name} installation status...
                </p>
              </div>
            ) : isInstalled ? (
              /* Case 3: Installed Configuration Panel */
              <>
                {/* Execution Mode */}
                {providerDef.executionModes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground">
                      <Layers className="size-3.5 text-muted-foreground" />
                      Execution Mode
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {providerDef.executionModes.map((m) => {
                        const isSelected =
                          (draftConfig.modeId || "default") === m.id;
                        return (
                          <button
                            className={cn(
                              "flex flex-col text-left p-2.5 rounded-xl border transition-colors cursor-pointer select-none",
                              isSelected
                                ? "border-primary/20 bg-primary/10 text-foreground"
                                : "border-border bg-secondary text-muted-foreground hover:border-white/[0.14] hover:text-foreground"
                            )}
                            key={m.id}
                            onClick={() => handleModeChange(m.id)}
                            type="button"
                          >
                            <span className="font-sans font-semibold text-xs text-foreground">
                              {m.label}
                            </span>
                            <span className="font-sans text-[10.5px] text-subtle mt-0.5 leading-tight">
                              {m.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Permissions & Autonomy */}
                {providerDef.permissionOptions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <Label className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground">
                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                      Permissions &amp; Autonomy
                    </Label>
                    <div className="space-y-2">
                      {providerDef.permissionOptions.map((perm) => {
                        const isEnabled =
                          draftConfig.enabledPermissions?.includes(perm.id) ??
                          false;
                        return (
                          <div
                            className={cn(
                              "flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors",
                              isEnabled && perm.isDangerous
                                ? "border-amber-500/30 bg-amber-500/[0.05]"
                                : isEnabled
                                  ? "border-primary/20 bg-primary/10"
                                  : "border-border bg-secondary"
                            )}
                            key={perm.id}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-sans font-medium text-xs text-foreground">
                                  {perm.label}
                                </span>
                                {perm.isDangerous && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                                    <AlertTriangle className="size-2.5" />
                                    HIGH ACCESS
                                  </span>
                                )}
                              </div>
                              <p className="font-sans text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                {perm.description}
                              </p>
                            </div>
                            <Switch
                              checked={isEnabled}
                              className="shrink-0 mt-0.5"
                              onCheckedChange={() =>
                                handleTogglePermission(perm)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Advanced Options */}
                {providerDef.advancedFlags.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <Label className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground">
                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                      Advanced Flags
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {providerDef.advancedFlags.map((flag) => {
                        if (flag.type === "boolean") {
                          const isChecked =
                            draftConfig.advancedFlagValues?.[flag.id] === true;
                          return (
                            <div
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl border border-border bg-secondary hover:border-white/[0.14] transition-colors select-none",
                                isChecked && "border-primary/20 bg-primary/10"
                              )}
                              key={flag.id}
                            >
                              <Label
                                className="min-w-0 pr-2 cursor-pointer flex-1"
                                htmlFor={`flag-toggle-${flag.id}`}
                              >
                                <span className="block font-sans font-medium text-xs text-foreground">
                                  {flag.label}
                                </span>
                                <span className="block font-sans text-[10px] text-subtle truncate">
                                  {flag.flag}
                                </span>
                              </Label>
                              <Switch
                                checked={isChecked}
                                id={`flag-toggle-${flag.id}`}
                                onCheckedChange={() =>
                                  handleAdvancedBooleanToggle(flag.id)
                                }
                              />
                            </div>
                          );
                        }

                        if (flag.type === "select") {
                          const val =
                            (draftConfig.advancedFlagValues?.[
                              flag.id
                            ] as string) || "";
                          return (
                            <div
                              className="p-2.5 rounded-xl border border-border bg-secondary space-y-1.5"
                              key={flag.id}
                            >
                              <Label className="font-sans font-medium text-xs text-muted-foreground">
                                {flag.label}
                              </Label>
                              <select
                                className="w-full h-8 rounded-lg border border-border bg-secondary px-2.5 font-sans text-xs text-foreground focus:outline-none focus:border-primary/60"
                                onChange={(e) =>
                                  handleAdvancedStringChange(
                                    flag.id,
                                    e.target.value
                                  )
                                }
                                value={val}
                              >
                                <option value="">Default</option>
                                {flag.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        // String input
                        const strVal =
                          (draftConfig.advancedFlagValues?.[
                            flag.id
                          ] as string) || "";
                        return (
                          <div
                            className="p-2.5 rounded-xl border border-border bg-secondary space-y-1.5"
                            key={flag.id}
                          >
                            <Label className="font-sans font-medium text-xs text-muted-foreground">
                              {flag.label}
                            </Label>
                            <Input
                              className="h-8 text-xs border-border bg-secondary rounded-lg"
                              onChange={(e) =>
                                handleAdvancedStringChange(
                                  flag.id,
                                  e.target.value
                                )
                              }
                              placeholder={flag.placeholder || flag.flag}
                              value={strVal}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Launch Command Override */}
                {providerDef.customArgsAllowed && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label
                        className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground"
                        htmlFor="custom-args-input"
                      >
                        <Terminal className="size-3.5 text-muted-foreground" />
                        Custom Launch Command
                      </Label>
                      {draftConfig.customArgs?.trim() && (
                        <span className="font-mono text-[10px] text-amber-400/90 font-medium">
                          Override active
                        </span>
                      )}
                    </div>
                    <Input
                      className="h-8.5 font-mono text-xs border-border bg-secondary rounded-xl text-foreground placeholder:text-subtle focus-visible:border-primary/60"
                      id="custom-args-input"
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          customArgs: e.target.value,
                        }))
                      }
                      placeholder={`e.g. ${providerDef.executable} --verbose`}
                      value={draftConfig.customArgs || ""}
                    />
                    <p className="font-sans text-[10.5px] text-subtle">
                      When specified, this exact command will be executed
                      instead of the default generated flags.
                    </p>
                  </div>
                )}

                {/* Command Preview */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 font-sans font-semibold text-xs text-muted-foreground">
                      <Code2 className="size-3.5 text-subtle" />
                      Command Preview
                    </Label>
                    <button
                      className="flex items-center gap-1 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      onClick={handleCopyPreview}
                      type="button"
                    >
                      {copiedPreview ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3 font-mono text-xs text-emerald-400 break-all select-all">
                    {preview.commandString}
                  </div>
                </div>
              </>
            ) : (
              /* Case 2: Not installed Notice */
              <div className="py-5 space-y-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Info className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading font-semibold text-sm text-foreground">
                    {agent.name} isn&apos;t installed yet
                  </h3>
                  <p className="font-sans text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Install {agent.name} first to customize its execution mode,
                    permission flags, and launch parameters.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2.5">
                  {onInstallRequest && (
                    <Button
                      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold text-xs h-8.5 px-4 rounded-xl cursor-pointer"
                      onClick={() => {
                        onOpenChange(false);
                        onInstallRequest(agent);
                      }}
                      size="sm"
                      type="button"
                    >
                      <Download className="size-3.5" />
                      Install {agent.name}
                    </Button>
                  )}
                  <Button
                    className="font-sans text-xs h-8.5 px-3.5 rounded-xl border border-border hover:bg-accent text-muted-foreground cursor-pointer"
                    onClick={() => onOpenChange(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {isInstalled && (
            <DialogFooter className="flex-shrink-0 flex items-center justify-between border-t border-border bg-card px-5 py-3">
              <Button
                className="gap-1.5 text-muted-foreground hover:text-foreground font-sans text-xs h-8 px-3 rounded-lg cursor-pointer"
                onClick={handleReset}
                size="sm"
                type="button"
                variant="ghost"
              >
                <RotateCcw className="size-3.5" />
                Reset Defaults
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  className="font-sans text-xs h-8 px-3.5 rounded-lg border border-border hover:bg-accent text-muted-foreground cursor-pointer"
                  onClick={() => onOpenChange(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-sans font-semibold text-xs h-8 px-4 rounded-lg cursor-pointer shadow-xs"
                  onClick={handleSave}
                  size="sm"
                  type="button"
                >
                  Save Configuration
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Dangerous Permission Confirmation Modal */}
      {confirmingDangerousPerm && (
        <Dialog
          onOpenChange={(op) => {
            if (!op) {
              setConfirmingDangerousPerm(null);
            }
          }}
          open={Boolean(confirmingDangerousPerm)}
        >
          <DialogContent className="max-w-[440px] border border-amber-500/30 bg-popover p-5 shadow-[0_24px_64px_rgba(0,0,0,0.9)] rounded-2xl">
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm text-foreground">
                    Enable {confirmingDangerousPerm.label}?
                  </h4>
                  <p className="font-mono text-[11px] text-amber-400/80">
                    {confirmingDangerousPerm.flag}
                  </p>
                </div>
              </div>

              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                {confirmingDangerousPerm.dangerousWarning ||
                  "This allows the AI CLI to execute commands and edit files without asking for confirmation."}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  className="text-xs h-8 px-3.5 rounded-xl border border-border text-muted-foreground hover:bg-accent cursor-pointer"
                  onClick={() => setConfirmingDangerousPerm(null)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-amber-500 text-black hover:bg-amber-400 font-semibold text-xs h-8 px-4 rounded-xl cursor-pointer"
                  onClick={() =>
                    handleConfirmDangerous(confirmingDangerousPerm)
                  }
                  size="sm"
                  type="button"
                >
                  Enable Access
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
