"use client";

import { FolderPickerDialog } from "@workspace/core/components/common/folder-picker-dialog";
import {
  DEFAULT_REPO_SETTINGS,
  type RepoSettings,
  useRepoSettingsStore,
} from "@workspace/core/stores/repo-settings-store";
import { useWorkspaceStore } from "@workspace/core/stores/workspace-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { FolderOpen } from "lucide-react";
import { useEffect, useId, useState } from "react";

const FIELD =
  "rounded-lg border border-border bg-input-bg text-foreground px-3 py-2 min-h-[64px] max-h-[300px] resize-y font-mono text-xs leading-relaxed placeholder:text-muted-foreground hover:border-border-hover outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus:border-primary/50 shadow-2xs transition-colors motion-fast dark:border-border dark:bg-secondary dark:text-foreground dark:hover:border-white/[0.14]";

/** Per-repository setup for task worktrees: files to copy and scripts to run. */
export function RepoSettingsDialog({
  onOpenChange,
  open,
  repoPath,
  workspaceId,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  repoPath: string;
  workspaceId?: string;
}) {
  const id = useId();
  const workspace = useWorkspaceStore((s) =>
    workspaceId ? s.workspaces.find((w) => w.id === workspaceId) : undefined
  );
  const setWorkspaceDirectory = useWorkspaceStore(
    (s) => s.setWorkspaceDirectory
  );

  const [directoryInput, setDirectoryInput] = useState(
    workspace?.directory ??
      (repoPath !== "." && repoPath !== "default" ? repoPath : "")
  );
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  const effectiveRepoPath =
    directoryInput.trim() ||
    (repoPath && repoPath !== "default" ? repoPath : "") ||
    workspace?.directory ||
    ".";

  const saved = useRepoSettingsStore((s) => s.byRepo[effectiveRepoPath]);
  const [draft, setDraft] = useState<RepoSettings>({
    ...DEFAULT_REPO_SETTINGS,
    ...saved,
  });

  useEffect(() => {
    if (open) {
      const initialDir =
        workspace?.directory ??
        (repoPath !== "." && repoPath !== "default" ? repoPath : "");
      setDirectoryInput(initialDir);
      const effective = initialDir.trim() || repoPath || ".";
      setDraft({
        ...DEFAULT_REPO_SETTINGS,
        ...useRepoSettingsStore.getState().byRepo[effective],
      });
    }
  }, [open, repoPath, workspace?.directory]);

  const set = <K extends keyof RepoSettings>(key: K, value: RepoSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const field = (
    key: "copyFiles" | "setupScript" | "devServerScript" | "cleanupScript",
    label: string,
    hint: string,
    rows = 2
  ) => (
    <div className="flex flex-col gap-1 text-xs">
      <label className="font-medium text-foreground" htmlFor={`${id}-${key}`}>
        {label}
      </label>
      <textarea
        className={FIELD}
        id={`${id}-${key}`}
        onChange={(e) => set(key, e.target.value)}
        rows={rows}
        spellCheck={false}
        value={draft[key]}
      />
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );

  const handleSave = () => {
    const dir = directoryInput.trim();
    if (workspaceId && dir) {
      setWorkspaceDirectory(workspaceId, dir);
    }
    const saveKey = dir || effectiveRepoPath;
    useRepoSettingsStore.getState().set(saveKey, draft);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {effectiveRepoPath === "."
                ? "Configure project directory and worktree settings"
                : effectiveRepoPath}
            </DialogDescription>
          </DialogHeader>

          {workspaceId && (
            <div className="flex flex-col gap-1 text-xs">
              <label
                className="font-medium text-foreground"
                htmlFor={`${id}-directory`}
              >
                Project Directory
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-input-bg text-foreground px-3 py-1.5 font-mono text-xs placeholder:text-muted-foreground hover:border-border-hover outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus:border-primary/50 shadow-2xs transition-colors motion-fast dark:border-border dark:bg-secondary dark:text-foreground dark:hover:border-white/[0.14]"
                  id={`${id}-directory`}
                  onChange={(e) => setDirectoryInput(e.target.value)}
                  placeholder="e.g. C:\path\to\project"
                  value={directoryInput}
                />
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer dark:border-glass-border dark:bg-glass-surface dark:text-muted-foreground dark:hover:bg-glass-surface-hover dark:hover:text-foreground"
                  onClick={() => setFolderPickerOpen(true)}
                  type="button"
                >
                  <FolderOpen className="size-3.5" />
                  <span>Browse</span>
                </button>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Repository root path. Task worktrees and automated branches are
                created from here.
              </span>
            </div>
          )}

          {field(
            "copyFiles",
            "Files to copy into each worktree",
            "One path or pattern per line, e.g. .env* or config/local.json. Lines starting with # are ignored."
          )}
          {field(
            "setupScript",
            "Setup script",
            "Runs once in every new worktree, e.g. pnpm install."
          )}
          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <input
              checked={draft.parallelSetup}
              className="accent-primary rounded size-3.5 cursor-pointer"
              onChange={(e) => set("parallelSetup", e.target.checked)}
              type="checkbox"
            />
            Run setup in the background (don't wait for it)
          </label>
          {field(
            "devServerScript",
            "Dev-server script",
            "Started from a task card to serve its worktree, e.g. pnpm dev. The preview finds its port automatically."
          )}
          {field(
            "cleanupScript",
            "Cleanup script",
            "Runs before a worktree is removed or merged."
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              onClick={handleSave}
              type="button"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {folderPickerOpen && (
        <FolderPickerDialog
          initialPath="THIS_PC"
          onOpenChange={setFolderPickerOpen}
          onSelectFolder={(selectedPath) => {
            setDirectoryInput(selectedPath);
            setFolderPickerOpen(false);
          }}
          open={folderPickerOpen}
          title="Select Project Directory"
        />
      )}
    </>
  );
}
