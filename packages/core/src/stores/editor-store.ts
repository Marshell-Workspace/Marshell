"use client";

import type { ExternalEditor } from "@workspace/core/lib/editor";
import { safeStorage } from "@workspace/core/lib/safe-json";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface EditorState {
  editor: ExternalEditor;
  setEditor: (editor: ExternalEditor) => void;
}

/** The editor "open in editor" buttons launch. */
export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({ editor: "code", setEditor: (editor) => set({ editor }) }),
    {
      name: "marshell-editor-v1",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
