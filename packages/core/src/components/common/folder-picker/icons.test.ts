import { describe, expect, it } from "vitest";
import {
  FluentDesktop,
  FluentFolder,
  FluentFolderOpen,
  FluentHardDrive,
  getEntryIcon,
  MarshallLogoMark,
  MatDocker,
  MatDocument,
  MatFolderGit,
  MatFolderGithub,
  MatFolderNode,
  MatFolderSrc,
  MatGitFile,
  MatImage,
  MatJson,
  MatLock,
  MatPdf,
  MatPython,
  MatReadme,
  MatSettings,
  MatTypescript,
  MatVideo,
  MatZip,
} from "./icons";

describe("getEntryIcon resolver", () => {
  it("resolves This PC / host root to FluentDesktop", () => {
    expect(getEntryIcon({ name: "This PC", type: "pc" })).toBe(FluentDesktop);
    expect(getEntryIcon({ name: "THIS_PC" })).toBe(FluentDesktop);
    expect(getEntryIcon({ name: "this pc" })).toBe(FluentDesktop);
  });

  it("resolves system drives to FluentHardDrive", () => {
    expect(getEntryIcon({ name: "C:\\", isDrive: true })).toBe(FluentHardDrive);
    expect(getEntryIcon({ name: "Local Disk (C:)", type: "drive" })).toBe(
      FluentHardDrive
    );
    expect(getEntryIcon({ name: "D:", isDrive: true })).toBe(FluentHardDrive);
  });

  it("resolves default folder to FluentFolder and open variant when requested", () => {
    expect(getEntryIcon({ name: "my-project", isDir: true })).toBe(
      FluentFolder
    );
    expect(
      getEntryIcon({ name: "my-project", isDir: true }, { isOpen: true })
    ).toBe(FluentFolderOpen);
    expect(
      getEntryIcon({ name: "my-project", isDir: true }, { isSelected: true })
    ).toBe(FluentFolderOpen);
  });

  it("resolves specialized developer folder names (case-insensitive)", () => {
    expect(getEntryIcon({ name: "node_modules", isDir: true })).toBe(
      MatFolderNode
    );
    expect(getEntryIcon({ name: "NODE_MODULES", isDir: true })).toBe(
      MatFolderNode
    );
    expect(getEntryIcon({ name: ".git", isDir: true })).toBe(MatFolderGit);
    expect(getEntryIcon({ name: ".github", isDir: true })).toBe(
      MatFolderGithub
    );
    expect(getEntryIcon({ name: "src", isDir: true })).toBe(MatFolderSrc);
    expect(getEntryIcon({ name: "SRC", isDir: true })).toBe(MatFolderSrc);
  });

  it("resolves special filenames", () => {
    expect(getEntryIcon({ name: "Dockerfile", isDir: false })).toBe(MatDocker);
    expect(getEntryIcon({ name: "README.md", isDir: false })).toBe(MatReadme);
    expect(getEntryIcon({ name: ".gitignore", isDir: false })).toBe(MatGitFile);
    expect(getEntryIcon({ name: "package.json", isDir: false })).toBe(MatLock);
    expect(getEntryIcon({ name: "pnpm-lock.yaml", isDir: false })).toBe(
      MatLock
    );
    expect(getEntryIcon({ name: "tsconfig.json", isDir: false })).toBe(
      MatSettings
    );
    expect(getEntryIcon({ name: ".env.local", isDir: false })).toBe(
      MatSettings
    );
  });

  it("resolves multi-dot files correctly", () => {
    expect(getEntryIcon({ name: "component.d.ts", isDir: false })).toBe(
      MatTypescript
    );
    expect(getEntryIcon({ name: "component.test.ts", isDir: false })).toBe(
      MatTypescript
    );
    expect(getEntryIcon({ name: "docker-compose.yml", isDir: false })).toBe(
      MatDocker
    );
  });

  it("resolves standard file extensions", () => {
    expect(getEntryIcon({ name: "script.py", isDir: false })).toBe(MatPython);
    expect(getEntryIcon({ name: "image.png", isDir: false })).toBe(MatImage);
    expect(getEntryIcon({ name: "video.mp4", isDir: false })).toBe(MatVideo);
    expect(getEntryIcon({ name: "doc.pdf", isDir: false })).toBe(MatPdf);
    expect(getEntryIcon({ name: "archive.zip", isDir: false })).toBe(MatZip);
    expect(getEntryIcon({ name: "config.json", isDir: false })).toBe(MatJson);
  });

  it("falls back to MatDocument for unknown or no extension", () => {
    expect(getEntryIcon({ name: "unknown-file", isDir: false })).toBe(
      MatDocument
    );
    expect(getEntryIcon({ name: "data.xyz123", isDir: false })).toBe(
      MatDocument
    );
  });

  describe("MarshallLogoMark", () => {
    it("is exported as a callable component rendering the app photo", () => {
      expect(typeof MarshallLogoMark).toBe("function");
      const element = MarshallLogoMark({ className: "test-logo" });
      expect(element).toBeDefined();
      expect(element.props.className).toBe("test-logo");
      expect(element.props.src).toBe("/main_logo.png");
    });
  });
});
