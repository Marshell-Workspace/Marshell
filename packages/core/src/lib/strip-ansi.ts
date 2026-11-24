/**
 * Strips ANSI escape codes, terminal color codes, and cursor movement sequences.
 */
const ANSI_REGEX =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

export function stripAnsi(input: string): string {
  if (typeof input !== "string" || !input) {
    return "";
  }
  return input.replace(ANSI_REGEX, "");
}
