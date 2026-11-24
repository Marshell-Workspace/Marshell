/** Subsequence score of `query` in `path` (higher is better), or -1 when it doesn't match. */
export function scorePath(path: string, query: string): number {
  const p = path.toLowerCase();
  const q = query.toLowerCase();
  const base = p.slice(p.lastIndexOf("/") + 1);
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const ch of q) {
    const at = p.indexOf(ch, from);
    if (at === -1) {
      return -1;
    }
    score += 1;
    if (at === previous + 1) {
      score += 5; // consecutive run
    }
    if (at === 0 || "/._-".includes(p[at - 1] ?? "")) {
      score += 3; // start of a path segment or word
    }
    previous = at;
    from = at + 1;
  }
  if (base.includes(q)) {
    score += 50;
    if (base.startsWith(q)) {
      score += 30;
    }
  }
  // Prefer shorter, shallower paths among equals.
  return score - p.length / 100;
}

/** The best matches for a query; with no query, the shallowest files. */
export function rankFiles(
  files: string[],
  query: string,
  limit = 30
): string[] {
  const q = query.trim();
  if (!q) {
    return [...files]
      .sort(
        (a, b) =>
          a.split("/").length - b.split("/").length || a.localeCompare(b)
      )
      .slice(0, limit);
  }
  return files
    .map((file) => ({ file, score: scorePath(file, q) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, limit)
    .map((r) => r.file);
}

export interface FileNode {
  children: FileNode[];
  isDir: boolean;
  name: string;
  path: string;
}

/** Folder tree for a flat list of paths: folders first, then files, alphabetical. */
export function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode = { children: [], isDir: true, name: "", path: "" };
  for (const path of paths) {
    let node = root;
    const parts = path.split("/");
    parts.forEach((name, i) => {
      const here = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.path === here);
      if (!child) {
        child = { children: [], isDir: i < parts.length - 1, name, path: here };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: FileNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)
    );
    for (const n of nodes) {
      sort(n.children);
    }
  };
  sort(root.children);
  return root.children;
}
