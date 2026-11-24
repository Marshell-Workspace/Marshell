export type LineType = "add" | "ctx" | "del";
export type FileStatus = "added" | "deleted" | "modified" | "renamed";

export interface DiffLine {
  newNo: number | null;
  oldNo: number | null;
  text: string;
  type: LineType;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  additions: number;
  binary: boolean;
  deletions: number;
  hunks: DiffHunk[];
  oldPath: string | null;
  path: string;
  status: FileStatus;
}

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Parses `git diff` output. Hunk bodies are read by line counts, so content such as `--- x` is safe. */
export function parseUnifiedDiff(patch: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null;
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;

  for (const line of patch.split("\n")) {
    if ((oldLeft > 0 || newLeft > 0) && file && hunk) {
      const mark = line[0];
      if (mark === "+" || mark === "-" || mark === " " || line === "") {
        const type: LineType =
          mark === "+" ? "add" : mark === "-" ? "del" : "ctx";
        hunk.lines.push({
          newNo: type === "del" ? null : newNo,
          oldNo: type === "add" ? null : oldNo,
          text: line.slice(1),
          type,
        });
        if (type !== "add") {
          oldNo++;
          oldLeft--;
        }
        if (type !== "del") {
          newNo++;
          newLeft--;
        }
        if (type === "add") {
          file.additions++;
        } else if (type === "del") {
          file.deletions++;
        }
        continue;
      }
    }

    const header = FILE_HEADER.exec(line);
    if (header) {
      file = {
        additions: 0,
        binary: false,
        deletions: 0,
        hunks: [],
        oldPath: null,
        path: header[2] as string,
        status: "modified",
      };
      hunk = null;
      oldLeft = 0;
      newLeft = 0;
      files.push(file);
      continue;
    }
    if (!file) {
      continue;
    }
    const hunkStart = HUNK_HEADER.exec(line);
    if (hunkStart) {
      oldNo = Number(hunkStart[1]);
      oldLeft = Number(hunkStart[2] ?? 1);
      newNo = Number(hunkStart[3]);
      newLeft = Number(hunkStart[4] ?? 1);
      hunk = { header: line, lines: [] };
      file.hunks.push(hunk);
    } else if (line.startsWith("new file mode")) {
      file.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      file.status = "deleted";
    } else if (line.startsWith("rename from ")) {
      file.status = "renamed";
      file.oldPath = line.slice("rename from ".length);
    } else if (line.startsWith("rename to ")) {
      file.path = line.slice("rename to ".length);
    } else if (line.startsWith("Binary files ")) {
      file.binary = true;
    }
  }
  return files;
}

export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/** Pairs each run of deletions with the additions that follow it. */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let dels: DiffLine[] = [];
  let adds: DiffLine[] = [];
  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i++) {
      rows.push({ left: dels[i] ?? null, right: adds[i] ?? null });
    }
    dels = [];
    adds = [];
  };
  for (const line of lines) {
    if (line.type === "del") {
      dels.push(line);
    } else if (line.type === "add") {
      adds.push(line);
    } else {
      flush();
      rows.push({ left: line, right: line });
    }
  }
  flush();
  return rows;
}

export interface TreeNode {
  additions: number;
  children: TreeNode[];
  deletions: number;
  file: FileDiff | null;
  name: string;
  path: string;
}

/** Folder tree of changed files; folders first, then alphabetical, with rolled-up stats. */
export function buildTree(files: FileDiff[]): TreeNode[] {
  const root: TreeNode = {
    additions: 0,
    children: [],
    deletions: 0,
    file: null,
    name: "",
    path: "",
  };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    parts.forEach((name, i) => {
      node.additions += file.additions;
      node.deletions += file.deletions;
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.path === path);
      if (!child) {
        child = {
          additions: 0,
          children: [],
          deletions: 0,
          file: null,
          name,
          path,
        };
        node.children.push(child);
      }
      node = child;
    });
    node.file = file;
    node.additions += file.additions;
    node.deletions += file.deletions;
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.children.length > 0) - Number(a.children.length > 0) ||
        a.name.localeCompare(b.name)
    );
    for (const n of nodes) {
      sort(n.children);
    }
  };
  sort(root.children);
  return root.children;
}

export function formatReviewComment(input: {
  comment: string;
  line: DiffLine;
  path: string;
}): string {
  const { comment, line, path } = input;
  const lineNo = line.newNo ?? line.oldNo;
  const side = line.type === "del" ? " (removed line)" : "";
  return [
    `Review comment on \`${path}:${lineNo}\`${side}:`,
    "```",
    line.text,
    "```",
    comment.trim(),
  ].join("\n");
}
