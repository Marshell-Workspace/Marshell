/** Splits a command line into program + args, honouring quotes and backslash escapes. No shell is involved. */
export function splitCommandLine(line: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && i + 1 < line.length) {
        current += line[++i];
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started || current) {
        parts.push(current);
        current = "";
        started = false;
      }
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote) {
    throw new Error("Unterminated quote in command");
  }
  if (started || current) {
    parts.push(current);
  }
  return parts;
}

export interface LogLine {
  seq: number;
  stream: "stderr" | "stdout" | "system";
  text: string;
}

/** Case-insensitive substring match, or a regex when `regex` is true. Bad regexes return an error. */
export function filterLogLines(
  lines: LogLine[],
  query: string,
  regex: boolean
): { error: string | null; lines: LogLine[] } {
  if (!query) {
    return { error: null, lines };
  }
  if (!regex) {
    const needle = query.toLowerCase();
    return {
      error: null,
      lines: lines.filter((l) => l.text.toLowerCase().includes(needle)),
    };
  }
  try {
    const re = new RegExp(query, "i");
    return { error: null, lines: lines.filter((l) => re.test(l.text)) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Invalid regex",
      lines,
    };
  }
}

/** Appends new lines, keeping only the most recent `max`. */
export function appendLogs(
  current: LogLine[],
  incoming: LogLine[],
  max: number
): LogLine[] {
  if (incoming.length === 0) {
    return current;
  }
  const merged = current.concat(incoming);
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}
