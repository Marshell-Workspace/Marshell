import { describe, expect, it } from "vitest";
import {
  calculateMaxVisibleTabs,
  deriveTabOverflow,
  deriveTabsFromPath,
  isDriveActive,
  isLocationActive,
  normalizeDriveDisplayName,
  normalizeDriveInfo,
  normalizeLocation,
} from "../folder-picker-dialog";

describe("Folder Picker pure helpers", () => {
  describe("normalizeDriveDisplayName", () => {
    it("normalizes root drive paths to Local Disk (X:)", () => {
      expect(normalizeDriveDisplayName("C:\\")).toBe("Local Disk (C:)");
      expect(normalizeDriveDisplayName("D:")).toBe("Local Disk (D:)");
      expect(normalizeDriveDisplayName("e:\\")).toBe("Local Disk (E:)");
    });

    it("normalizes uppercase drive names", () => {
      expect(normalizeDriveDisplayName("LOCAL DISK (C:)")).toBe(
        "Local Disk (C:)"
      );
      expect(normalizeDriveDisplayName("Local Disk (d:)")).toBe(
        "Local Disk (D:)"
      );
    });

    it("falls back to raw name when not a drive letter", () => {
      expect(normalizeDriveDisplayName("My Folder")).toBe("My Folder");
      expect(normalizeDriveDisplayName("Root (/)")).toBe("Root (/)");
    });
  });

  describe("deriveTabsFromPath", () => {
    it("returns single active This PC tab for root", () => {
      const tabs = deriveTabsFromPath("THIS_PC");
      expect(tabs).toEqual([
        { id: "THIS_PC", name: "This PC", path: "THIS_PC", isRoot: true },
      ]);
    });

    it("returns This PC and drive tab when inside C:\\", () => {
      const tabs = deriveTabsFromPath("C:\\");
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toEqual({
        id: "THIS_PC",
        name: "This PC",
        path: "THIS_PC",
        isRoot: true,
      });
      expect(tabs[1]?.name).toBe("Local Disk (C:)");
      expect(tabs[1]?.isDrive).toBe(true);
      expect(tabs[1]?.path).toBe("C:\\");
    });

    it("returns full ancestry stack inside folders", () => {
      const tabs = deriveTabsFromPath("C:\\Program Files");
      expect(tabs).toHaveLength(3);
      expect(tabs[0]?.name).toBe("This PC");
      expect(tabs[1]?.name).toBe("Local Disk (C:)");
      expect(tabs[2]?.name).toBe("Program Files");
      expect(tabs[2]?.path).toBe("C:\\Program Files");
    });

    it("handles deeply nested folders", () => {
      const tabs = deriveTabsFromPath(
        "C:\\Users\\Developer\\Projects\\Marshell\\packages"
      );
      expect(tabs).toHaveLength(7);
      expect(tabs[0]?.name).toBe("This PC");
      expect(tabs[1]?.name).toBe("Local Disk (C:)");
      expect(tabs[6]?.name).toBe("packages");
    });

    it("handles UNC paths correctly without crashing", () => {
      const tabs = deriveTabsFromPath("\\\\server\\share\\projects\\marshell");
      expect(tabs).toHaveLength(5);
      expect(tabs[0]?.name).toBe("This PC");
      expect(tabs[1]?.name).toBe("server");
      expect(tabs[1]?.isDrive).toBe(true);
      expect(tabs[2]?.name).toBe("share");
      expect(tabs[2]?.isDrive).toBe(true);
      expect(tabs[3]?.name).toBe("projects");
      expect(tabs[4]?.name).toBe("marshell");
    });
  });

  describe("deriveTabOverflow", () => {
    it("keeps all tabs displayed when within limit", () => {
      const tabs = deriveTabsFromPath("C:\\Program Files");
      const { displayed, collapsed } = deriveTabOverflow(tabs, 4);
      expect(displayed).toHaveLength(3);
      expect(collapsed).toHaveLength(0);
    });

    it("folds intermediate ancestors into collapsed when exceeding limit", () => {
      const tabs = deriveTabsFromPath(
        "C:\\Users\\Developer\\Projects\\Marshell\\packages"
      );
      // tabs length = 7: [This PC, C:, Users, Developer, Projects, Marshell, packages]
      const { displayed, collapsed } = deriveTabOverflow(tabs, 4);
      // Displays first (This PC), penultimate (Marshell), and last (packages)
      expect(displayed).toHaveLength(3);
      expect(displayed[0]?.name).toBe("This PC");
      expect(displayed[1]?.name).toBe("Marshell");
      expect(displayed[2]?.name).toBe("packages");

      // Collapsed holds intermediate ancestors: C:, Users, Developer, Projects
      expect(collapsed).toHaveLength(4);
      expect(collapsed[0]?.name).toBe("Local Disk (C:)");
      expect(collapsed.at(-1)?.name).toBe("Projects");
    });

    it("keeps only first and last when maxVisible is 2", () => {
      const tabs = deriveTabsFromPath("C:\\Users\\Developer\\Projects");
      const { displayed, collapsed } = deriveTabOverflow(tabs, 2);
      expect(displayed).toHaveLength(2);
      expect(displayed[0]?.name).toBe("This PC");
      expect(displayed[1]?.name).toBe("Projects");
      expect(collapsed.length).toBeGreaterThan(0);
    });
  });

  describe("normalizeDriveInfo", () => {
    it("normalizes drive paths and extracts letter and label", () => {
      expect(normalizeDriveInfo("C:\\")).toEqual({
        letter: "C:",
        label: "Local Disk",
        path: "C:\\",
      });
      expect(normalizeDriveInfo("d:")).toEqual({
        letter: "D:",
        label: "Local Disk",
        path: "D:\\",
      });
      expect(normalizeDriveInfo("Projects (E:)")).toEqual({
        letter: "E:",
        label: "Local Disk",
        path: "E:\\",
      });
    });
  });

  describe("isDriveActive", () => {
    it("returns false in This PC view", () => {
      expect(isDriveActive("C:", "THIS_PC")).toBe(false);
      expect(isDriveActive("D:", "THIS_PC")).toBe(false);
    });

    it("returns true when current path matches drive", () => {
      expect(isDriveActive("C:", "C:\\")).toBe(true);
      expect(isDriveActive("C:", "C:\\Program Files")).toBe(true);
      expect(isDriveActive("D:", "C:\\Program Files")).toBe(false);
      expect(isDriveActive("D:", "D:\\Projects")).toBe(true);
    });
  });

  describe("calculateMaxVisibleTabs", () => {
    it("returns responsive limits based on location bar width", () => {
      expect(calculateMaxVisibleTabs(200)).toBe(2);
      expect(calculateMaxVisibleTabs(300)).toBe(3);
      expect(calculateMaxVisibleTabs(450)).toBe(4);
      expect(calculateMaxVisibleTabs(600)).toBe(5);
      expect(calculateMaxVisibleTabs(0)).toBe(4);
    });
  });

  describe("cross-platform locations", () => {
    it("labels Windows drives by type", () => {
      expect(
        normalizeLocation({ name: "x", path: "D:\\", driveType: "removable" })
      ).toEqual({ letter: "D:", label: "Removable Disk", path: "D:\\" });
    });

    it("labels macOS and Linux locations without a drive letter", () => {
      expect(
        normalizeLocation({ name: "Home (/Users/dev)", path: "/Users/dev" })
      ).toEqual({ letter: "Home", label: "/Users/dev", path: "/Users/dev" });
      expect(normalizeLocation({ name: "Root (/)", path: "/" })).toEqual({
        letter: "Root",
        label: "/",
        path: "/",
      });
    });

    it("activates the most specific POSIX location only", () => {
      const all = ["/Users/dev", "/", "/Volumes/Backup"];
      expect(isLocationActive("/Users/dev", "/Users/dev/app", all)).toBe(true);
      expect(isLocationActive("/", "/Users/dev/app", all)).toBe(false);
      expect(isLocationActive("/", "/etc", all)).toBe(true);
      expect(isLocationActive("/Volumes/Backup", "/Volumes/BackupX", all)).toBe(
        false
      );
      expect(isLocationActive("/", "THIS_PC", all)).toBe(false);
    });
  });
});
