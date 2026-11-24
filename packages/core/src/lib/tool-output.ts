export const MAX_INLINE_BYTES = 25 * 1024;

function clipBytes(text: string, max: number, tail = false) {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(
    tail ? bytes.slice(-max) : bytes.slice(0, max)
  );
}

export function toolOutputPreview(content: string, path: string): string {
  const lines = content.split("\n");
  // Lines alone cannot bound minified JSON or a single very long line.
  const head = clipBytes(lines.slice(0, 60).join("\n"), 10_000);
  const tail = clipBytes(
    lines.length > 60
      ? lines.slice(Math.max(60, lines.length - 40)).join("\n")
      : content,
    7000,
    true
  );
  return `[Output exceeded 25KB. Showing first 60 and last 40 lines (byte bounded). Full output saved to: ${path}]\n${head}\n…\n${tail}`;
}

export async function retainToolOutput(
  content: string,
  root: string
): Promise<string> {
  if (new TextEncoder().encode(content).length <= MAX_INLINE_BYTES) {
    return content;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const path = await invoke<string>("save_tool_output", { root, content });
    return toolOutputPreview(content, path);
  } catch (error) {
    // Never pretend a discarded output was saved. Keep the result if storage fails.
    return `[Could not save full tool output: ${error instanceof Error ? error.message : String(error)}]\n${content}`;
  }
}
