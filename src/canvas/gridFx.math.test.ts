import { describe, expect, it } from "vitest";
import { wirePath } from "../model/geometry";
import { cubicFromPath, dotKey, nearestFreeDot, plusOffsets, portCentre, sampleEvenly, springStep } from "./gridFx.math";

describe("the port +", () => {
  it("sits just outside the middle of each side", () => {
    const r = { x: 0, y: 0, w: 200, h: 100 };
    expect(portCentre(r, "top", 10)).toEqual({ x: 100, y: -10 });
    expect(portCentre(r, "right", 10)).toEqual({ x: 210, y: 50 });
    expect(portCentre(r, "bottom", 10)).toEqual({ x: 100, y: 110 });
    expect(portCentre(r, "left", 10)).toEqual({ x: -10, y: 50 });
  });

  it("is five dots, centre first, arms the same length", () => {
    const p = plusOffsets(6);
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    for (const o of p.slice(1)) expect(Math.hypot(o.x, o.y)).toBe(6);
  });
});

describe("sampling the wire", () => {
  const curve = cubicFromPath(wirePath({ x: 0, y: 0, side: "right" }, { x: 300, y: 120, side: "left" }).path)!;

  it("reads the curve wirePath draws", () => {
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    expect(curve[3]).toEqual({ x: 300, y: 120 });
    expect(cubicFromPath("nonsense")).toBeNull();
  });

  it("puts points at even spacing along the curve and ends at the pointer", () => {
    const pts = sampleEvenly(curve, 11, 11);
    expect(pts[pts.length - 1]).toEqual({ x: 300, y: 120 });
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      expect(d).toBeGreaterThan(10);
      expect(d).toBeLessThanOrEqual(11.01);
    }
  });

  it("keeps each point in place as the wire grows, adding new ones at the end", () => {
    const line = (len: number) => cubicFromPath(`M 0 0 C ${len / 3} 0 ${(2 * len) / 3} 0 ${len} 0`)!;
    const short = sampleEvenly(line(100), 10, 15);
    const long = sampleEvenly(line(200), 10, 15);
    expect(long.length).toBeGreaterThan(short.length);
    for (let i = 0; i < short.length - 1; i++) expect(long[i].x).toBeCloseTo(short[i].x, 6);
  });

  it("is only the end when the wire is shorter than one step", () => {
    const pts = sampleEvenly(cubicFromPath("M 0 0 C 1 0 2 0 3 0")!, 11, 16);
    expect(pts).toEqual([{ x: 3, y: 0 }]);
  });
});

describe("borrowing grid dots", () => {
  it("takes the nearest grid dot", () => {
    expect(nearestFreeDot({ x: 40, y: 70 }, 32, 100, () => true)).toEqual({ i: 1, j: 2 });
  });

  it("skips dots already out, taking the next nearest", () => {
    const out = new Set([dotKey(1, 2)]);
    const got = nearestFreeDot({ x: 40, y: 70 }, 32, 100, (i, j) => !out.has(dotKey(i, j)));
    expect(got).not.toEqual({ i: 1, j: 2 });
    const d = Math.hypot(got!.i * 32 - 40, got!.j * 32 - 70);
    // Next nearest of (1,2) at ~10px: (2,2) at ~25px.
    expect(d).toBeCloseTo(Math.hypot(64 - 40, 64 - 70), 6);
  });

  it("gives up when nothing free is in reach", () => {
    expect(nearestFreeDot({ x: 16, y: 16 }, 32, 10, () => true)).toBeNull();
    expect(nearestFreeDot({ x: 0, y: 0 }, 32, 100, () => false)).toBeNull();
  });

  it("keys negative and positive dots apart", () => {
    const keys = new Set<number>();
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) keys.add(dotKey(i, j));
    expect(keys.size).toBe(49);
  });
});

describe("springs", () => {
  it("settle on the target", () => {
    let x = 0;
    let v = 0;
    for (let i = 0; i < 120; i++) [x, v] = springStep(x, v, 100, { k: 420, c: 31 }, 1 / 60);
    expect(x).toBeCloseTo(100, 2);
    expect(Math.abs(v)).toBeLessThan(0.1);
  });

  it("stay stable through a long frame", () => {
    const [x] = springStep(0, 0, 100, { k: 560, c: 38 }, 0.5);
    expect(Number.isFinite(x)).toBe(true);
    expect(Math.abs(x - 100)).toBeLessThan(100);
  });
});
