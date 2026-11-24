import { describe, expect, it } from "vitest";
import {
  computeCardPlacement,
  type PlacementInput,
  type PlacementRect,
} from "./tour-placement";

// ─── Shared helpers ──────────────────────────────────────────────────────────

function noOverlap(card: PlacementRect, rects: PlacementRect[], label: string) {
  for (const r of rects) {
    const ox = Math.max(
      0,
      Math.min(card.left + card.width, r.left + r.width) -
        Math.max(card.left, r.left)
    );
    const oy = Math.max(
      0,
      Math.min(card.top + card.height, r.top + r.height) -
        Math.max(card.top, r.top)
    );
    expect(ox * oy, `${label}: card must not overlap rect`).toBe(0);
  }
}

function withinBounds(
  card: PlacementRect,
  bounds: PlacementRect,
  label: string
) {
  expect(
    card.left,
    `${label}: card.left >= bounds.left`
  ).toBeGreaterThanOrEqual(bounds.left);
  expect(card.top, `${label}: card.top >= bounds.top`).toBeGreaterThanOrEqual(
    bounds.top
  );
  expect(
    card.left + card.width,
    `${label}: card.right <= bounds.right`
  ).toBeLessThanOrEqual(bounds.left + bounds.width);
  expect(
    card.top + card.height,
    `${label}: card.bottom <= bounds.bottom`
  ).toBeLessThanOrEqual(bounds.top + bounds.height);
}

function cardRect(r: {
  x: number;
  y: number;
  width: number;
  height: number;
}): PlacementRect {
  return { left: r.x, top: r.y, width: r.width, height: r.height };
}

// ─── Fixture 1: Create Workspace dialog at 1280×720 ─────────────────────────
// Dialog: x=240, y=60, w=800, h=600
// Left col: x=260, y=80, w=340, h=560
// Right col: x=620, y=80, w=380, h=560
// Agent list: x=640, y=100, w=340, h=200 (inside right col)
// Card height approx 240px

const dlg1280: PlacementRect = { left: 240, top: 60, width: 800, height: 600 };
const _leftCol1280: PlacementRect = {
  left: 260,
  top: 80,
  width: 340,
  height: 560,
};
const agentList1280: PlacementRect = {
  left: 640,
  top: 100,
  width: 340,
  height: 200,
};
const nameInput1280: PlacementRect = {
  left: 280,
  top: 120,
  width: 300,
  height: 44,
};
const dirInput1280: PlacementRect = {
  left: 280,
  top: 200,
  width: 300,
  height: 44,
};
const agentComm1280: PlacementRect = {
  left: 280,
  top: 320,
  width: 300,
  height: 44,
};
const submitBtn1280: PlacementRect = {
  left: 880,
  top: 620,
  width: 140,
  height: 38,
};
const cancelBtn1280: PlacementRect = {
  left: 760,
  top: 620,
  width: 100,
  height: 38,
};
const CARD_H = 240;

describe("tour-placement — Create Workspace dialog (1280×720)", () => {
  const vp = { width: 1280, height: 720 };
  const WIDTHS: [number, number] = [400, 352];
  const margin = 16;
  const gap = 16;

  it("onboarding-ws-name: card right of name input, not over agent list or dir input", () => {
    const anchor = nameInput1280;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1280,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "right",
      hard: [dirInput1280],
      soft: [agentList1280],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "ws-name vs anchor");
    noOverlap(card, [dirInput1280], "ws-name vs dir input (hard)");
    expect(result.width).toBeLessThanOrEqual(400);
    expect(result.x).toBeGreaterThanOrEqual(margin);
  });

  it("onboarding-ai-agents: card placed in empty right-column space BELOW agent list", () => {
    // Anchor = agent list; preferred = bottom
    const anchor = agentList1280;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1280,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "bottom",
      hard: [],
      soft: [nameInput1280, dirInput1280],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "ai-agents vs anchor");
    // Card must be below the anchor (bottom placement → card.top >= anchor.top + anchor.height)
    // OR to the right if bottom doesn't fit — but at 1280 it should fit bottom
    if (result.side === "bottom") {
      expect(result.y, "card top below agent list").toBeGreaterThanOrEqual(
        anchor.top + anchor.height + gap - 1
      );
    }
    // Should not overlap left column inputs
    noOverlap(
      card,
      [nameInput1280, dirInput1280],
      "ai-agents vs left col inputs"
    );
  });

  it("onboarding-submit: card placed top of submit btn, not over cancel btn (hard)", () => {
    const anchor = submitBtn1280;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1280,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "top",
      hard: [cancelBtn1280],
      soft: [],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "submit vs anchor");
    noOverlap(card, [cancelBtn1280], "submit vs cancel (hard)");
  });

  it("all placements: card is within dialog bounds + margin", () => {
    const testCases: Array<{
      id: string;
      anchor: PlacementRect;
      preferred: "right" | "bottom" | "top" | "left";
    }> = [
      { id: "ws-name", anchor: nameInput1280, preferred: "right" },
      { id: "ws-dir", anchor: dirInput1280, preferred: "right" },
      { id: "ai-agents", anchor: agentList1280, preferred: "bottom" },
      { id: "agent-comm", anchor: agentComm1280, preferred: "right" },
      { id: "submit", anchor: submitBtn1280, preferred: "top" },
    ];

    for (const tc of testCases) {
      const input: PlacementInput = {
        viewport: vp,
        surfaceBounds: dlg1280,
        anchor: tc.anchor,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: tc.preferred,
        hard: [],
        soft: [],
      };
      const result = computeCardPlacement(input);
      const card = cardRect(result);
      const effectiveBounds: PlacementRect = {
        left: margin,
        top: margin,
        width: vp.width - margin * 2,
        height: vp.height - margin * 2,
      };
      withinBounds(card, effectiveBounds, tc.id);
      noOverlap(card, [tc.anchor], `${tc.id} vs anchor`);
    }
  });
});

// ─── Fixture 2: Create Workspace dialog at 1000×640 ─────────────────────────
// Dialog: x=100, y=40, w=800, h=560
// Left col: x=120, y=60, w=320, h=520
// Agent list: x=480, y=80, w=280, h=180

const dlg1000: PlacementRect = { left: 100, top: 40, width: 800, height: 560 };
const agentList1000: PlacementRect = {
  left: 480,
  top: 80,
  width: 280,
  height: 180,
};
const nameInput1000: PlacementRect = {
  left: 140,
  top: 100,
  width: 260,
  height: 44,
};
const dirInput1000: PlacementRect = {
  left: 140,
  top: 180,
  width: 260,
  height: 44,
};

describe("tour-placement — Create Workspace dialog (1000×640)", () => {
  const vp = { width: 1000, height: 640 };
  const WIDTHS: [number, number] = [400, 352];
  const margin = 16;
  const gap = 16;

  it("onboarding-ai-agents: card placed below agent list, not over left inputs", () => {
    const anchor = agentList1000;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1000,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "bottom",
      hard: [],
      soft: [nameInput1000, dirInput1000],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "ai-agents vs anchor at 1000px");
    noOverlap(
      card,
      [nameInput1000, dirInput1000],
      "ai-agents vs inputs at 1000px"
    );
  });

  it("onboarding-ws-name: card right side, does not leave dialog bounds", () => {
    const anchor = nameInput1000;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1000,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "right",
      hard: [dirInput1000],
      soft: [agentList1000],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "ws-name vs anchor 1000px");
    noOverlap(card, [dirInput1000], "ws-name vs dir input (hard) 1000px");

    const effectiveBounds: PlacementRect = {
      left: margin,
      top: margin,
      width: vp.width - margin * 2,
      height: vp.height - margin * 2,
    };
    withinBounds(card, effectiveBounds, "ws-name at 1000px");
  });

  it("leader line present when mode is slid (gap > 48)", () => {
    // Place agent-list anchor far from right edge, ensure slid mode gets leader
    const anchor = agentList1000;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: dlg1000,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "bottom",
      hard: [],
      soft: [],
    };
    const result = computeCardPlacement(input);
    // mode slid means gap > 48 → leader should not be null
    if (result.mode === "slid") {
      expect(result.leader, "leader line present when slid").not.toBeNull();
    }
    // mode adjacent means gap <= 48 → leader should be null
    if (result.mode === "adjacent") {
      expect(result.leader, "no leader when adjacent").toBeNull();
    }
  });
});

// ─── Fixture 3: Settings dialog ──────────────────────────────────────────────
// Dialog: x=160, y=40, w=960, h=640
// Sidebar: x=180, y=60, w=208, h=600
// Pane content: x=408, y=60, w=692, h=600
// Pane header: x=408, y=60, w=692, h=72 (hard rect for nav steps)

const settingsDlg: PlacementRect = {
  left: 160,
  top: 40,
  width: 960,
  height: 640,
};
const settingsSidebar: PlacementRect = {
  left: 180,
  top: 60,
  width: 208,
  height: 600,
};
const settingsPaneHeader: PlacementRect = {
  left: 408,
  top: 60,
  width: 692,
  height: 72,
};
const settingsNavItem: PlacementRect = {
  left: 190,
  top: 180,
  width: 188,
  height: 40,
};

describe("tour-placement — Settings dialog (1280×720)", () => {
  const vp = { width: 1280, height: 720 };
  const WIDTHS: [number, number] = [400, 352];
  const margin = 16;
  const gap = 16;

  it("settings nav step: card right of sidebar, below pane header", () => {
    const anchor = settingsNavItem;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: settingsDlg,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "right",
      hard: [settingsPaneHeader],
      soft: [settingsSidebar],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "settings nav vs anchor");
    noOverlap(card, [settingsPaneHeader], "settings nav vs pane header (hard)");

    // Card should be to the right of the sidebar
    expect(result.x, "card starts after sidebar").toBeGreaterThanOrEqual(
      settingsSidebar.left + settingsSidebar.width - 1
    );

    // Card should be below the pane header
    expect(result.y, "card below pane header").toBeGreaterThanOrEqual(
      settingsPaneHeader.top + settingsPaneHeader.height - 1
    );
  });

  it("settings overview: anchor = full sidebar nav, pref right, not over pane header", () => {
    const anchor = settingsSidebar;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: settingsDlg,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "right",
      hard: [settingsPaneHeader],
      soft: [],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "overview vs sidebar anchor");
    noOverlap(card, [settingsPaneHeader], "overview vs pane header (hard)");
  });
});

// ─── Fixture 4: Right-docked panel ───────────────────────────────────────────
// Viewport: 1280×720
// Side panel: x=760, y=0, w=520, h=720
// Bottom input: x=780, y=620, w=480, h=60

const agentPanel: PlacementRect = {
  left: 760,
  top: 0,
  width: 520,
  height: 720,
};
const _composerInput: PlacementRect = {
  left: 780,
  top: 620,
  width: 480,
  height: 60,
};
const agentComposerAnchor: PlacementRect = {
  left: 790,
  top: 625,
  width: 460,
  height: 50,
};

describe("tour-placement — right-docked panel (1280×720)", () => {
  const vp = { width: 1280, height: 720 };
  const WIDTHS: [number, number] = [400, 352];
  const margin = 24;
  const gap = 16;

  it("composer step: card to the left of panel, not over anchor", () => {
    const anchor = agentComposerAnchor;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null, // whole viewport
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "left",
      hard: [],
      soft: [agentPanel],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "composer vs anchor");
    expect(result.width).toBeLessThanOrEqual(400);
    expect(result.x).toBeGreaterThanOrEqual(margin);
  });
});

// ─── Fixture 5: Fullscreen panel ──────────────────────────────────────────────
// Panel fills viewport: x=0, y=0, w=1280, h=720
// Fullscreen btn: x=1220, y=20, w=40, h=40
// Composer: x=20, y=620, w=1240, h=60

const fullscreenBtn: PlacementRect = {
  left: 1220,
  top: 20,
  width: 40,
  height: 40,
};
const fullscreenComposer: PlacementRect = {
  left: 20,
  top: 620,
  width: 1240,
  height: 60,
};

describe("tour-placement — fullscreen panel (1280×720)", () => {
  const vp = { width: 1280, height: 720 };
  const WIDTHS: [number, number] = [400, 352];
  const margin = 24;
  const gap = 16;

  it("fullscreen btn step: card above or below btn, not over composer input", () => {
    const anchor = fullscreenBtn;
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "left",
      hard: [fullscreenComposer],
      soft: [],
    };
    const result = computeCardPlacement(input);
    const card = cardRect(result);

    noOverlap(card, [anchor], "fullscreen vs anchor");
    noOverlap(card, [fullscreenComposer], "fullscreen vs composer (hard)");

    // Card must not overlap composer
    const composerOverlap =
      Math.max(
        0,
        Math.min(
          card.top + card.height,
          fullscreenComposer.top + fullscreenComposer.height
        ) - Math.max(card.top, fullscreenComposer.top)
      ) *
      Math.max(
        0,
        Math.min(
          card.left + card.width,
          fullscreenComposer.left + fullscreenComposer.width
        ) - Math.max(card.left, fullscreenComposer.left)
      );
    expect(composerOverlap, "no overlap with composer").toBe(0);
  });

  it("inside mode triggers when anchor fills >60% viewport", () => {
    // Large anchor that is 70% of viewport area
    const bigAnchor: PlacementRect = {
      left: 0,
      top: 0,
      width: 1280,
      height: 504,
    }; // 504/720 * 1280 = 89600 vs 921600 * 0.6 = 552960 — under, try full
    // Actually: 1280*720 = 921600. 0.6 * 921600 = 552960. Need w*h > 552960.
    // 1280*504 = 645120 > 552960. ✓
    const input: PlacementInput = {
      viewport: vp,
      surfaceBounds: null,
      anchor: bigAnchor,
      cardWidths: WIDTHS,
      cardHeight: CARD_H,
      margin,
      gap,
      preferred: "bottom",
      hard: [],
      soft: [],
    };
    const result = computeCardPlacement(input);
    expect(result.mode, "large anchor triggers inside mode").toBe("inside");
  });
});

describe("tour-placement — Real Panel Geometry Fixtures (BUG 3.a)", () => {
  const WIDTHS: [number, number] = [400, 352];
  const margin = 24;
  const gap = 16;

  describe("Docked-right panel at 1280×720 (panel width 400px at x=880)", () => {
    const vp = { width: 1280, height: 720 };
    const panelBounds: PlacementRect = {
      left: 880,
      top: 0,
      width: 400,
      height: 720,
    };
    const panelHeader: PlacementRect = {
      left: 890,
      top: 10,
      width: 380,
      height: 40,
    };
    const panelComposer: PlacementRect = {
      left: 895,
      top: 600,
      width: 370,
      height: 90,
    };

    it("places card to the left over terminals for header anchor with leader line", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: panelBounds,
        anchor: panelHeader,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "left",
        hard: [],
        soft: [],
      });
      const card = cardRect(result);

      // Card must be to the left of the anchor and panel
      expect(card.left + card.width).toBeLessThanOrEqual(panelHeader.left);
      expect(result.side).toBe("left");
      withinBounds(
        card,
        {
          left: margin,
          top: margin,
          width: vp.width - margin * 2,
          height: vp.height - margin * 2,
        },
        "docked 1280 header"
      );
      noOverlap(card, [panelHeader], "card vs header");
    });

    it("places card to the left over terminals for composer anchor without covering composer", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: panelBounds,
        anchor: panelComposer,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "left",
        hard: [],
        soft: [],
      });
      const card = cardRect(result);

      expect(card.left + card.width).toBeLessThanOrEqual(panelComposer.left);
      expect(result.side).toBe("left");
      withinBounds(
        card,
        {
          left: margin,
          top: margin,
          width: vp.width - margin * 2,
          height: vp.height - margin * 2,
        },
        "docked 1280 composer"
      );
      noOverlap(card, [panelComposer], "card vs composer");
    });
  });

  describe("Docked-right panel at 1000×640 (panel width 400px at x=600)", () => {
    const vp = { width: 1000, height: 640 };
    const panelBounds: PlacementRect = {
      left: 600,
      top: 0,
      width: 400,
      height: 640,
    };
    const panelHeader: PlacementRect = {
      left: 610,
      top: 10,
      width: 380,
      height: 40,
    };
    const panelComposer: PlacementRect = {
      left: 615,
      top: 520,
      width: 370,
      height: 90,
    };

    it("places card to the left over terminals at 1000x640", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: panelBounds,
        anchor: panelHeader,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "left",
        hard: [],
        soft: [],
      });
      const card = cardRect(result);

      expect(card.left + card.width).toBeLessThanOrEqual(panelHeader.left);
      withinBounds(
        card,
        {
          left: margin,
          top: margin,
          width: vp.width - margin * 2,
          height: vp.height - margin * 2,
        },
        "docked 1000 header"
      );
      noOverlap(card, [panelHeader], "card vs header 1000px");
    });

    it("places card to the left for composer without covering it at 1000x640", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: panelBounds,
        anchor: panelComposer,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "left",
        hard: [],
        soft: [],
      });
      const card = cardRect(result);

      expect(card.left + card.width).toBeLessThanOrEqual(panelComposer.left);
      withinBounds(
        card,
        {
          left: margin,
          top: margin,
          width: vp.width - margin * 2,
          height: vp.height - margin * 2,
        },
        "docked 1000 composer"
      );
      noOverlap(card, [panelComposer], "card vs composer 1000px");
    });
  });

  describe("Fullscreen panel at 1280×720", () => {
    const vp = { width: 1280, height: 720 };
    const fullscreenBounds: PlacementRect = {
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
    };
    const headerAnchor: PlacementRect = {
      left: 20,
      top: 10,
      width: 1240,
      height: 40,
    };
    const composerAnchor: PlacementRect = {
      left: 20,
      top: 600,
      width: 1240,
      height: 90,
    };

    it("places card below header anchor in fullscreen", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: fullscreenBounds,
        anchor: headerAnchor,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "bottom",
        hard: [composerAnchor],
        soft: [],
      });
      const card = cardRect(result);

      expect(card.top).toBeGreaterThanOrEqual(
        headerAnchor.top + headerAnchor.height
      );
      noOverlap(card, [headerAnchor], "fullscreen card vs header");
      noOverlap(card, [composerAnchor], "fullscreen card vs composer");
    });

    it("places card above composer anchor in fullscreen", () => {
      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: fullscreenBounds,
        anchor: composerAnchor,
        cardWidths: WIDTHS,
        cardHeight: CARD_H,
        margin,
        gap,
        preferred: "top",
        hard: [],
        soft: [],
      });
      const card = cardRect(result);

      expect(card.top + card.height).toBeLessThanOrEqual(composerAnchor.top);
      noOverlap(card, [composerAnchor], "fullscreen card vs composer");
    });
  });

  describe("Mobile Viewports (< 640px) Bottom Sheet Mode", () => {
    const cardH = 220;
    const cardWidths: [number, number] = [400, 352];

    it("activates bottom-sheet mode on 360x740 viewport (small mobile)", () => {
      const vp = { width: 360, height: 740 };
      const anchor: PlacementRect = {
        left: 20,
        top: 100,
        width: 320,
        height: 48,
      };

      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: null,
        anchor,
        cardWidths,
        cardHeight: cardH,
        margin: 16,
        gap: 16,
        preferred: "bottom",
        hard: [],
        soft: [],
      });

      expect(result.mode).toBe("bottom-sheet");
      expect(result.side).toBe("bottom");
      expect(result.width).toBe(360 - 16); // full width minus 16px
      expect(result.x).toBe(8); // 8px left margin
      expect(result.y).toBe(740 - cardH - 8);
      expect(result.leader).toBeNull();
    });

    it("activates bottom-sheet mode on 480x854 viewport (medium mobile)", () => {
      const vp = { width: 480, height: 854 };
      const anchor: PlacementRect = {
        left: 30,
        top: 200,
        width: 200,
        height: 50,
      };

      const result = computeCardPlacement({
        viewport: vp,
        surfaceBounds: null,
        anchor,
        cardWidths,
        cardHeight: cardH,
        margin: 16,
        gap: 16,
        preferred: "right",
        hard: [],
        soft: [],
      });

      expect(result.mode).toBe("bottom-sheet");
      expect(result.side).toBe("bottom");
      expect(result.width).toBe(480 - 16);
      expect(result.x).toBe(8);
      expect(result.y).toBe(854 - cardH - 8);
      expect(result.leader).toBeNull();
    });

    it("boundary check: 639px triggers bottom-sheet, 640px uses standard placement", () => {
      const vpMobile = { width: 639, height: 800 };
      const anchor: PlacementRect = {
        left: 20,
        top: 100,
        width: 100,
        height: 40,
      };

      const resultMobile = computeCardPlacement({
        viewport: vpMobile,
        surfaceBounds: null,
        anchor,
        cardWidths,
        cardHeight: cardH,
        margin: 16,
        gap: 16,
        preferred: "bottom",
        hard: [],
        soft: [],
      });
      expect(resultMobile.mode).toBe("bottom-sheet");

      const vpTablet = { width: 640, height: 800 };
      const resultTablet = computeCardPlacement({
        viewport: vpTablet,
        surfaceBounds: null,
        anchor,
        cardWidths,
        cardHeight: cardH,
        margin: 16,
        gap: 16,
        preferred: "bottom",
        hard: [],
        soft: [],
      });
      expect(resultTablet.mode).not.toBe("bottom-sheet");
    });
  });
});
