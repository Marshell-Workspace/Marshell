/** Accept JSON arrays for lossless editing, or quoted command-line arguments. */
export function parseCommandArguments(input: string): string[] {
  const trimmed = input.trim();
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      !(
        Array.isArray(parsed) &&
        parsed.every((item: unknown) => typeof item === "string")
      )
    ) {
      throw new Error("Arguments must be a JSON array of strings");
    }
    return parsed;
  }
  const args: string[] = [];
  let value = "";
  let quote: string | undefined;
  let started = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === undefined) {
      continue;
    }
    if (
      char === "\\" &&
      quote !== "'" &&
      (input[index + 1] === '"' || input[index + 1] === "\\")
    ) {
      value += input[index + 1];
      index += 1;
      started = true;
    } else if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        value += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(value);
      }
      value = "";
      started = false;
    } else {
      value += char;
      started = true;
    }
  }
  if (quote) {
    throw new Error("Unclosed quote in arguments");
  }
  if (started) {
    args.push(value);
  }
  return args;
}
