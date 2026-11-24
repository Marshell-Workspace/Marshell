import {
  buildFileTree,
  rankFiles,
  scorePath,
} from "@workspace/core/lib/file-search";
import { describe, expect, it } from "vitest";

const FILES = [
  "src/components/Header.tsx",
  "src/components/header-menu/index.ts",
  "src/lib/hooks/use-header.ts",
  "docs/HEADER.md",
  "README.md",
  "packages/core/src/pages/workspace-page.tsx",
  "src/app/layout.tsx",
];

describe("rankFiles", () => {
  it("ranks file-name matches above matches that are only in a folder name", () => {
    const ranked = rankFiles(FILES, "header");
    // Both start their file name with the query; the shorter path wins the tie.
    expect(ranked.slice(0, 2).sort()).toEqual([
      "docs/HEADER.md",
      "src/components/Header.tsx",
    ]);
    expect(ranked.indexOf("src/lib/hooks/use-header.ts")).toBeLessThan(
      ranked.indexOf("src/components/header-menu/index.ts")
    );
  });

  it("matches subsequences, case-insensitively, and drops non-matches", () => {
    expect(rankFiles(FILES, "wsp")[0]).toBe(
      "packages/core/src/pages/workspace-page.tsx"
    );
    expect(rankFiles(FILES, "zzz")).toEqual([]);
    expect(scorePath("a/b.ts", "xyz")).toBe(-1);
  });

  it("lists the shallowest files for an empty query and honours the limit", () => {
    expect(rankFiles(FILES, "")[0]).toBe("README.md");
    expect(rankFiles(FILES, "", 2)).toHaveLength(2);
    expect(rankFiles(FILES, "e", 3)).toHaveLength(3);
  });
});

describe("buildFileTree", () => {
  it("nests folders first, then files", () => {
    const tree = buildFileTree(["b.txt", "src/z.ts", "src/lib/a.ts", "a.txt"]);
    expect(tree.map((n) => [n.name, n.isDir])).toEqual([
      ["src", true],
      ["a.txt", false],
      ["b.txt", false],
    ]);
    expect(tree[0]?.children.map((n) => n.name)).toEqual(["lib", "z.ts"]);
    expect(tree[0]?.children[0]?.children[0]?.path).toBe("src/lib/a.ts");
  });
});
