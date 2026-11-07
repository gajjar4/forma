import { describe, expect, it } from "vitest";
import {
  cellMetrics,
  chooseColumns,
  fitSize,
  moveItem,
  placeAxis,
  planGrid,
  sizeIn,
  slotAt,
  slotPosition,
  stagger,
} from "./layout";
import { poseFromTransform, poseOnPile } from "./pile";

const margins = { top: 112, right: 72, bottom: 96, left: 72 };
const viewport = { w: 1440, h: 900 };

describe("cellMetrics", () => {
  it("keeps cells and gaps in a sane range at any width", () => {
    for (const w of [600, 1024, 1440, 1920, 3000]) {
      const { cell, gap } = cellMetrics(w);
      expect(cell).toBeGreaterThanOrEqual(168);
      expect(cell).toBeLessThanOrEqual(264);
      expect(gap).toBeGreaterThanOrEqual(48);
      expect(gap).toBeLessThanOrEqual(68);
    }
  });
});

describe("chooseColumns", () => {
  it("follows the shape of the free space", () => {
    expect(chooseColumns(1, { w: 1300, h: 700 })).toBe(1);
    expect(chooseColumns(6, { w: 1300, h: 700 })).toBe(3);
    expect(chooseColumns(4, { w: 700, h: 1300 })).toBe(1);
    expect(chooseColumns(50, { w: 1300, h: 700 })).toBeGreaterThan(8);
  });

  it("never asks for more columns than images", () => {
    expect(chooseColumns(2, { w: 5000, h: 100 })).toBe(2);
  });
});

describe("placeAxis", () => {
  it("centres a short grid on the anchor", () => {
    expect(placeAxis(200, 1000, 50, 50, 500)).toEqual({ sheet: 1000, origin: 400, scroll: 0 });
  });

  it("keeps a short grid inside the margins near an edge", () => {
    expect(placeAxis(200, 1000, 50, 50, 0).origin).toBe(50);
    expect(placeAxis(200, 1000, 50, 50, 1000).origin).toBe(750);
  });

  it("adds the same room on both sides and opens past it", () => {
    expect(placeAxis(200, 1000, 50, 50, 500, 300)).toEqual({ sheet: 1600, origin: 700, scroll: 300 });
    const long = placeAxis(3000, 1000, 50, 50, 0, 300);
    expect(long).toEqual({ sheet: 3700, origin: 350, scroll: 300 });
  });

  it("gives a long grid a sheet, scrolled toward the anchor", () => {
    const top = placeAxis(3000, 1000, 50, 50, 0);
    expect(top).toEqual({ sheet: 3100, origin: 50, scroll: 0 });
    const bottom = placeAxis(3000, 1000, 50, 50, 1000);
    expect(bottom.scroll).toBe(3100 - 1000);
    const middle = placeAxis(3000, 1000, 50, 50, 500);
    expect(middle.scroll).toBe(1050);
    expect(bottom.scroll).toBe(bottom.sheet - 1000);
  });
});

describe("planGrid", () => {
  it("unfolds a small stack from where it was clicked", () => {
    const top = planGrid(6, viewport, { x: 300, y: 150 }, margins);
    const bottom = planGrid(6, viewport, { x: 1200, y: 800 }, margins);
    // On screen, the grid sits at its sheet position minus the opening scroll.
    expect(top.origin.y - top.scroll.y).toBe(margins.top);
    expect(top.origin.x - top.scroll.x).toBe(margins.left);
    expect(bottom.origin.y - bottom.scroll.y + bottom.rows * bottom.pitch - bottom.gap).toBe(viewport.h - margins.bottom);
  });

  it("always leaves room to move a small stack around, in every direction", () => {
    const plan = planGrid(6, viewport, { x: 720, y: 450 }, margins);
    expect(plan.scroll.x).toBeGreaterThan(0);
    expect(plan.scroll.y).toBeGreaterThan(0);
    expect(plan.sheet.w - viewport.w - plan.scroll.x).toBeGreaterThan(0);
    expect(plan.sheet.h - viewport.h - plan.scroll.y).toBeGreaterThan(0);
  });

  it("turns a big stack into a field that scrolls both ways", () => {
    const plan = planGrid(60, viewport, { x: 720, y: 450 }, margins);
    expect(plan.cols * plan.rows).toBeGreaterThanOrEqual(60);
    expect(plan.sheet.w).toBeGreaterThan(viewport.w);
    expect(plan.sheet.h).toBeGreaterThan(viewport.h);
    expect(plan.scroll.x).toBeGreaterThan(0);
    expect(plan.scroll.x).toBeLessThanOrEqual(plan.sheet.w - viewport.w);
    expect(plan.scroll.y).toBeLessThanOrEqual(plan.sheet.h - viewport.h);
  });
});

describe("slots", () => {
  const plan = planGrid(7, viewport, { x: 720, y: 450 }, margins);

  it("centres each image in its cell", () => {
    const size = fitSize(400, 200, plan.cell);
    const p = slotPosition(plan, 0, size);
    expect(p.x).toBe(plan.origin.x);
    expect(p.y).toBe(plan.origin.y + (plan.cell - size.h) / 2);
    const second = slotPosition(plan, plan.cols, size);
    expect(second.y - p.y).toBe(plan.pitch);
  });

  it("finds the slot under a point, gaps included", () => {
    const at = (i: number) => {
      const p = slotPosition(plan, i, { w: plan.cell, h: plan.cell });
      return { x: p.x + plan.cell / 2, y: p.y + plan.cell / 2 };
    };
    for (let i = 0; i < 7; i++) expect(slotAt(plan, at(i))).toBe(i);
    // In the gap just right of cell 0, closer to cell 0.
    const c0 = slotPosition(plan, 0, { w: plan.cell, h: plan.cell });
    expect(slotAt(plan, { x: c0.x + plan.cell + plan.gap / 2 - 1, y: c0.y + 10 })).toBe(0);
    expect(slotAt(plan, { x: c0.x + plan.cell + plan.gap / 2 + 1, y: c0.y + 10 })).toBe(1);
  });

  it("snaps points off the grid to the nearest edge, and to the last image", () => {
    expect(slotAt(plan, { x: -5000, y: -5000 })).toBe(0);
    expect(slotAt(plan, { x: 99999, y: 99999 })).toBe(6);
  });
});

describe("moveItem", () => {
  it("moves one entry and closes up the rest", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });
});

describe("fitSize", () => {
  it("keeps proportions and fills the box on the long side", () => {
    expect(fitSize(400, 200, 200)).toEqual({ w: 200, h: 100 });
    expect(fitSize(225, 300, 240)).toEqual({ w: 180, h: 240 });
    expect(fitSize(undefined, undefined, 100)).toEqual({ w: 100, h: 100 });
  });
});

describe("stagger", () => {
  it("steps evenly, then squeezes a long run into the cap", () => {
    expect(stagger(0, 6, 0.03, 0.3)).toBe(0);
    expect(stagger(5, 6, 0.03, 0.3)).toBeCloseTo(0.15);
    expect(stagger(59, 60, 0.03, 0.3)).toBeCloseTo(0.3);
  });
});

describe("poseFromTransform", () => {
  it("reads rotation and scale out of a matrix", () => {
    const r = (12 * Math.PI) / 180;
    const s = 1.02;
    const m = `matrix(${s * Math.cos(r)}, ${s * Math.sin(r)}, ${-s * Math.sin(r)}, ${s * Math.cos(r)}, -34, 6)`;
    const pose = poseFromTransform(m);
    expect(pose.rotate).toBeCloseTo(12);
    expect(pose.scale).toBeCloseTo(1.02);
  });

  it("treats no transform as upright", () => {
    expect(poseFromTransform("none")).toEqual({ rotate: 0, scale: 1 });
  });
});

describe("poseOnPile", () => {
  const pile = {
    centre: { x: 500, y: 300 },
    cards: [
      { cx: 492, cy: 304, w: 100, h: 80, rotate: -5 },
      { cx: 500, cy: 300, w: 120, h: 90, rotate: 0 },
    ],
  };

  it("puts the cover on the top card, upright and at its drawn size", () => {
    const p = poseOnPile(0, { w: 240, h: 180 }, pile, { x: 10, y: 20 })!;
    expect(p.x + 120).toBe(510);
    expect(p.y + 90).toBe(320);
    expect(p.scale).toBeCloseTo(0.5);
    expect(p.rotate).toBe(0);
    expect(p.opacity).toBe(1);
  });

  it("puts the next image on the card under it, tilted like it", () => {
    expect(poseOnPile(1, { w: 200, h: 160 }, pile, { x: 0, y: 0 })!.rotate).toBe(-5);
  });

  it("hides images deeper than the pile under its centre", () => {
    const p = poseOnPile(5, { w: 200, h: 200 }, pile, { x: 0, y: 0 })!;
    expect(p.opacity).toBe(0);
    expect(p.x + 100).toBe(500);
  });
});

describe("sizeIn", () => {
  it("fills a cell with an image's proportions, a note upright, a link landscape", () => {
    expect(sizeIn({ id: "i", kind: "image", w: 400, h: 200 }, 200)).toEqual({ w: 200, h: 100 });
    const note = sizeIn({ id: "n", kind: "note", text: "" }, 200);
    expect(note.h).toBe(200);
    expect(note.w).toBeLessThan(200);
    const link = sizeIn({ id: "l", kind: "link", url: "https://a.com" }, 200);
    expect(link.w).toBe(200);
    expect(link.h).toBeLessThan(200);
  });
});
