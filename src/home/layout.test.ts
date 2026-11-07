import { describe, expect, it } from "vitest";
import { GRID } from "../canvas/dots";
import { CELL_H, CELL_W, diveTransform, homeLayout } from "./layout";

describe("homeLayout", () => {
  it("fits as many columns as the window takes, never more than there are piles", () => {
    expect(homeLayout(3, 1440, 900).cols).toBe(3);
    expect(homeLayout(9, 1440, 900).cols).toBe(4);
    expect(homeLayout(9, 720, 480).cols).toBe(1);
  });

  it("puts every pile's centre on a dot", () => {
    for (const s of homeLayout(7, 1333, 811).spots) {
      expect(s.x % GRID).toBe(0);
      expect(s.y % GRID).toBe(0);
    }
  });

  it("centres the grid, and wraps rows left to right", () => {
    const { spots } = homeLayout(5, 1440, 900);
    const xs = spots.map((s) => s.x);
    expect(xs[4]).toBe(xs[0]);
    expect(spots[4].y - spots[0].y).toBe(CELL_H);
    const mid = (xs[0] + xs[3]) / 2;
    expect(Math.abs(mid - 720)).toBeLessThanOrEqual(GRID);
    expect(xs[1] - xs[0]).toBe(CELL_W);
  });

  it("sits in the middle while it fits, and grows the surface when it doesn't", () => {
    const one = homeLayout(1, 1440, 900);
    expect(Math.abs(one.spots[0].y - 450)).toBeLessThan(CELL_H / 2);
    expect(one.height).toBe(900);
    const many = homeLayout(24, 1440, 900);
    expect(many.height).toBeGreaterThan(900);
    expect(many.spots[0].y).toBe(GRID * 3 + GRID * 4);
  });
});

describe("diveTransform", () => {
  it("brings the pile's centre to the middle of the window, scaled", () => {
    const t = diveTransform({ left: 100, top: 200, width: 200, height: 200 }, { width: 1000, height: 800 }, 4);
    // The pile's centre (200, 300) lands on (500, 400).
    expect(200 * t.scale + t.x).toBe(500);
    expect(300 * t.scale + t.y).toBe(400);
  });
});
