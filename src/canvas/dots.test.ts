import { describe, expect, it } from "vitest";
import { axisDots, dotStyle, FADE_OUT, FULL, GRID, snapToDots } from "./dots";

/** Board positions of the dots visible on a 1000px-wide strip at a given pan and zoom. */
const visible = (x: number, zoom: number) => {
  const { spacing } = dotStyle(zoom);
  const { first, count } = axisDots(x, spacing, 1000);
  return Array.from({ length: count }, (_, i) => (first + i) * GRID);
};

describe("dotStyle", () => {
  it("spreads the dots apart as you zoom in, and brings them together as you zoom out", () => {
    expect(dotStyle(1).spacing).toBe(GRID);
    expect(dotStyle(2).spacing).toBe(GRID * 2);
    expect(dotStyle(0.5).spacing).toBe(GRID / 2);
  });

  it("grows the dots with the zoom, within limits", () => {
    expect(dotStyle(1).size).toBe(2);
    expect(dotStyle(4).size).toBe(4);
    expect(dotStyle(2).size).toBeGreaterThan(dotStyle(1).size);
    expect(dotStyle(0.01).size).toBe(1);
    expect(dotStyle(100).size).toBe(5);
  });

  it("fades the whole grid out only where it would crowd into noise", () => {
    expect(dotStyle(FULL / GRID).alpha).toBe(1);
    expect(dotStyle(1).alpha).toBe(1);
    expect(dotStyle(FADE_OUT / GRID).alpha).toBe(0);
    const mid = dotStyle((FADE_OUT + FULL) / 2 / GRID).alpha;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("copes with a zoom of zero or nonsense", () => {
    expect(dotStyle(0).spacing).toBe(GRID);
    expect(dotStyle(Number.NaN).spacing).toBe(GRID);
  });
});

describe("the dots belong to the board", () => {
  it("only ever shows dots on the board grid, at any pan and zoom", () => {
    for (const [x, zoom] of [[100, 1], [-337.5, 1.7], [12.25, 0.6], [900, 3.9]]) {
      for (const p of visible(x, zoom)) expect(Math.abs(p % GRID)).toBe(0);
    }
  });

  it("puts each dot exactly where the board puts that point", () => {
    const x = -337.5;
    const zoom = 1.7;
    const { spacing } = dotStyle(zoom);
    const { first } = axisDots(x, spacing, 1000);
    const boardX = first * GRID;
    expect(x + first * spacing).toBeCloseTo(x + boardX * zoom, 9);
  });

  it("covers the screen", () => {
    const { first, count } = axisDots(10, 50, 200);
    expect(first).toBe(0);
    expect(count).toBe(4);
    expect(axisDots(-130, 50, 200, 31).first).toBe(2);
  });
});

describe("snapToDots", () => {
  it("moves a position to the nearest dot", () => {
    expect(snapToDots({ x: 47, y: -17 })).toEqual({ x: 32, y: -32 });
    expect(snapToDots({ x: 49, y: 15 })).toEqual({ x: 64, y: 0 });
    expect(snapToDots({ x: -170, y: -70 })).toEqual({ x: -160, y: -64 });
  });
});
