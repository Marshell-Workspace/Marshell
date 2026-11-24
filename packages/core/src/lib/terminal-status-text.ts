// A bounded text view for status inspection. Preserve cursor positioning and
// erasure instead of concatenating text that a CLI has already overwritten.
const MAX_ROWS = 128;
const MAX_COLUMNS = 512;

export interface TerminalStatusText {
  column: number;
  escape: "" | "start" | "csi" | "string" | "string-escape" | "charset";
  lines: string[];
  parameters: string;
  row: number;
  savedCursor?: { row: number; column: number };
}

export function appendTerminalStatusText(
  previous: TerminalStatusText | undefined,
  chunk: string
): TerminalStatusText {
  const state: TerminalStatusText = previous
    ? { ...previous, lines: [...previous.lines] }
    : { lines: [""], row: 0, column: 0, escape: "", parameters: "" };
  const line = () => state.lines[state.row] ?? "";
  const setLine = (value: string) => {
    while (state.lines.length <= state.row) {
      state.lines.push("");
    }
    state.lines[state.row] = value.slice(0, MAX_COLUMNS);
  };
  const down = (count: number) => {
    state.row += count;
    if (state.row >= MAX_ROWS) {
      state.lines.splice(0, state.row - MAX_ROWS + 1);
      state.row = MAX_ROWS - 1;
    }
  };
  const eraseLine = (mode: number) => {
    if (mode === 0) {
      setLine(line().slice(0, state.column));
    } else if (mode === 1) {
      setLine(" ".repeat(state.column + 1) + line().slice(state.column + 1));
    } else if (mode === 2) {
      setLine("");
    }
  };
  const applyControl = (command: string) => {
    // Private modes (including bracketed paste and cursor visibility) are not text.
    if (!/^[\d;]*$/.test(state.parameters)) {
      return;
    }
    const values = state.parameters.split(";").map(Number);
    const count = Math.min(values[0] || 1, MAX_COLUMNS);
    switch (command) {
      case "H":
      case "f":
        state.row = Math.min((values[0] || 1) - 1, MAX_ROWS - 1);
        state.column = Math.min((values[1] || 1) - 1, MAX_COLUMNS - 1);
        break;
      case "A":
        state.row = Math.max(0, state.row - count);
        break;
      case "B":
        state.row = Math.min(MAX_ROWS - 1, state.row + count);
        break;
      case "C":
        state.column = Math.min(MAX_COLUMNS - 1, state.column + count);
        break;
      case "D":
        state.column = Math.max(0, state.column - count);
        break;
      case "G":
        state.column = count - 1;
        break;
      case "d":
        state.row = Math.min(MAX_ROWS - 1, count - 1);
        break;
      case "K":
        eraseLine(values[0] ?? 0);
        break;
      case "J": {
        const mode = values[0] ?? 0;
        if (mode === 0) {
          eraseLine(0);
          state.lines.splice(state.row + 1);
        } else if (mode === 1) {
          eraseLine(1);
          state.lines.fill("", 0, state.row);
        } else if (mode === 2 || mode === 3) {
          state.lines = [];
        }
        break;
      }
      case "s":
        state.savedCursor = { row: state.row, column: state.column };
        break;
      case "u":
        if (state.savedCursor) {
          Object.assign(state, state.savedCursor);
        }
        break;
      default:
        break;
    }
  };

  for (const character of chunk) {
    if (state.escape === "string" || state.escape === "string-escape") {
      if (
        character === "\x07" ||
        (state.escape === "string-escape" && character === "\\")
      ) {
        state.escape = "";
      } else {
        state.escape = character === "\x1b" ? "string-escape" : "string";
      }
      continue;
    }
    if (character === "\x1b") {
      state.escape = "start";
      continue;
    }
    if (state.escape === "start") {
      state.escape = "";
      if (character === "[") {
        state.escape = "csi";
        state.parameters = "";
      } else if (
        character === "]" ||
        character === "P" ||
        character === "^" ||
        character === "_"
      ) {
        state.escape = "string";
      } else if ("()*+".includes(character)) {
        state.escape = "charset";
      }
      continue;
    }
    if (state.escape === "charset") {
      state.escape = "";
      continue;
    }
    if (state.escape === "csi") {
      if (character >= "@" && character <= "~") {
        applyControl(character);
        state.escape = "";
      } else {
        // Malformed or oversized sequences must not grow the status buffer.
        state.parameters = (state.parameters + character).slice(-64);
      }
      continue;
    }
    if (character === "\r") {
      state.column = 0;
    } else if (character === "\n") {
      down(1);
      state.column = 0;
    } else if (character === "\b") {
      state.column = Math.max(0, state.column - 1);
    } else if (character === "\t") {
      state.column = Math.min(
        MAX_COLUMNS - 1,
        (Math.floor(state.column / 8) + 1) * 8
      );
    } else if (
      character >= " " &&
      character !== "\x7f" &&
      state.column < MAX_COLUMNS
    ) {
      const before = line().padEnd(state.column, " ");
      setLine(
        before.slice(0, state.column) +
          character +
          before.slice(state.column + character.length)
      );
      state.column += character.length;
    }
  }
  return state;
}

export function terminalStatusText(state: TerminalStatusText): string {
  return state.lines.join("\n");
}
