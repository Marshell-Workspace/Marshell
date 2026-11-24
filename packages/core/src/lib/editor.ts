import { invoke } from "@tauri-apps/api/core";
import { notify } from "@workspace/core/lib/notify";
import { useEditorStore } from "@workspace/core/stores/editor-store";

export type ExternalEditor = "code" | "cursor" | "zed" | "subl";

export const EXTERNAL_EDITORS: Array<{ id: ExternalEditor; label: string }> = [
  { id: "code", label: "VS Code" },
  { id: "cursor", label: "Cursor" },
  { id: "zed", label: "Zed" },
  { id: "subl", label: "Sublime" },
];

export const openInExternalEditor = (
  path: string,
  editor: ExternalEditor,
  line?: number
): Promise<void> =>
  invoke<void>("open_in_external_editor", { editor, line, path });

const isAbsolute = (p: string) =>
  p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p);

/** `root` + a relative path, or the path itself when it is already absolute. */
export function resolveFilePath(root: string, file: string): string {
  if (isAbsolute(file)) {
    return file;
  }
  return `${root.replace(/[\\/]+$/, "")}/${file.replace(/^\.?[\\/]/, "")}`;
}

/** Opens a file (optionally at a line) in the user's chosen editor, reporting failures. */
export async function openFileInEditor(
  root: string,
  file: string,
  line?: number
): Promise<void> {
  try {
    await openInExternalEditor(
      resolveFilePath(root, file),
      useEditorStore.getState().editor,
      line
    );
  } catch (e) {
    notify(
      "Could not open the editor",
      e instanceof Error ? e.message : String(e),
      "warning",
      { native: false }
    );
  }
}
