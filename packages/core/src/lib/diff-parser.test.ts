import {
  buildTree,
  formatReviewComment,
  parseUnifiedDiff,
  toSplitRows,
} from "@workspace/core/lib/diff-parser";
import { describe, expect, it } from "vitest";

const PATCH = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 keep
--- a dashed line
+++ b plus line
 tail
diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+fresh
diff --git a/old.txt b/moved.txt
similarity index 100%
rename from old.txt
rename to moved.txt
diff --git a/img.png b/img.png
new file mode 100644
Binary files /dev/null and b/img.png differ
`;

describe("parseUnifiedDiff", () => {
  const files = parseUnifiedDiff(PATCH);

  it("finds each file with its status", () => {
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ["src/a.ts", "modified"],
      ["new.txt", "added"],
      ["moved.txt", "renamed"],
      ["img.png", "added"],
    ]);
    expect(files[2]?.oldPath).toBe("old.txt");
    expect(files[3]?.binary).toBe(true);
  });

  it("reads hunk lines by count, so dashed content is not mistaken for headers", () => {
    const a = files[0];
    expect(a?.additions).toBe(1);
    expect(a?.deletions).toBe(1);
    expect(a?.hunks[0]?.lines.map((l) => [l.type, l.oldNo, l.newNo])).toEqual([
      ["ctx", 1, 1],
      ["del", 2, null],
      ["add", null, 2],
      ["ctx", 3, 3],
    ]);
  });

  it("handles an empty patch", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});

describe("toSplitRows", () => {
  it("pairs deletions with following additions", () => {
    const lines = parseUnifiedDiff(PATCH)[0]?.hunks[0]?.lines ?? [];
    const rows = toSplitRows(lines);
    expect(rows).toHaveLength(3);
    expect(rows[1]?.left?.type).toBe("del");
    expect(rows[1]?.right?.type).toBe("add");
  });
});

describe("buildTree", () => {
  it("nests folders first and rolls up stats", () => {
    const tree = buildTree(parseUnifiedDiff(PATCH));
    expect(tree.map((n) => n.name)).toEqual([
      "src",
      "img.png",
      "moved.txt",
      "new.txt",
    ]);
    expect(tree[0]?.additions).toBe(1);
    expect(tree[0]?.children[0]?.file?.path).toBe("src/a.ts");
  });
});

describe("formatReviewComment", () => {
  it("bundles file, line, snippet and comment", () => {
    const line = {
      newNo: 42,
      oldNo: null,
      text: "const x = 1;",
      type: "add" as const,
    };
    const out = formatReviewComment({
      comment: " rename x ",
      line,
      path: "src/a.ts",
    });
    expect(out).toContain("`src/a.ts:42`");
    expect(out).toContain("const x = 1;");
    expect(out.endsWith("rename x")).toBe(true);
  });
});
