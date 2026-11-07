import { describe, expect, it } from "vitest";
import { outside, REACH, reachOf, rippleDots, strength } from "./gridFx.ripple";

const box = { x: 0, y: 0, w: 64, h: 64 };

describe("ripple", () => {
  it("measures how far a point is outside a box", () => {
    expect(outside(box, 32, 32)).toBe(0);
    expect(outside(box, 96, 32)).toBe(32);
    expect(outside(box, 64 + 3, 64 + 4)).toBe(5);
  });

  it("runs a ring out from the edge that is gone by the end", () => {
    expect(strength(0, 0)).toBe(0);
    expect(strength(REACH / 2, 1)).toBe(0);
    // Early on the ring is near the edge, later further out.
    expect(strength(16, 0.08)).toBeGreaterThan(strength(120, 0.08));
    expect(strength(120, 0.6)).toBeGreaterThan(strength(16, 0.6));
    // And it fades as it goes.
    expect(strength(REACH * 0.3, 0.1)).toBeGreaterThan(strength(REACH * 0.94, 0.75));
  });

  it("touches grid dots around the thing, never under it", () => {
    const dots = rippleDots(box, 0.15, 32);
    expect(dots.size).toBeGreaterThan(0);
    for (const { i, j } of dots.values()) expect(outside(box, i * 32, j * 32)).toBeGreaterThan(0);
    expect(rippleDots(box, 1, 32).size).toBe(0);
  });

  it("keeps the stronger where two ripples meet", () => {
    const into = rippleDots(box, 0.1, 32);
    const before = new Map([...into].map(([k, v]) => [k, v.s]));
    rippleDots({ x: 64, y: 0, w: 64, h: 64 }, 0.9, 32, into);
    for (const [k, s] of before) expect(into.get(k)!.s).toBeGreaterThanOrEqual(s);
  });

  it("finds the box every running ripple fits in", () => {
    expect(reachOf([])).toBeNull();
    const r = reachOf([{ rect: box }, { rect: { x: 200, y: 100, w: 10, h: 10 } }])!;
    expect(r).toEqual({ x: -REACH, y: -REACH, w: 210 + REACH * 2, h: 110 + REACH * 2 });
  });
});
