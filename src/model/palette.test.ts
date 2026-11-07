import { describe, expect, it } from "vitest";
import { isHex, paletteOf, toHex } from "./palette";

/** RGBA bytes: `n` pixels of each colour, in order. */
function pixels(...runs: [number, [number, number, number, number?]][]) {
  const out: number[] = [];
  for (const [n, [r, g, b, a = 255]] of runs) for (let i = 0; i < n; i++) out.push(r, g, b, a);
  return out;
}

describe("palette", () => {
  it("finds the colours of a picture, the one covering most of it first", () => {
    expect(paletteOf(pixels([40, [0, 0, 255]], [60, [255, 0, 0]]))).toEqual(["#ff0000", "#0000ff"]);
  });

  it("reads slight noise around one colour as that one colour", () => {
    const data = pixels([25, [100, 150, 200]], [25, [104, 146, 203]], [25, [97, 152, 198]], [25, [102, 149, 201]]);
    const palette = paletteOf(data);
    expect(palette).toHaveLength(1);
    expect(palette[0]).toMatch(/^#6[45]9[56]c[89]$/);
  });

  it("leaves out see-through pixels and stray specks", () => {
    expect(paletteOf(pixels([90, [255, 255, 255]], [500, [255, 0, 0, 0]], [1, [0, 0, 0]]))).toEqual(["#ffffff"]);
  });

  it("gives at most five colours, all valid hex", () => {
    const data: number[] = [];
    for (let i = 0; i < 256; i++) data.push(i, 255 - i, (i * 7) % 256, 255);
    const palette = paletteOf(data);
    expect(palette.length).toBeGreaterThan(1);
    expect(palette.length).toBeLessThanOrEqual(5);
    expect(palette.every(isHex)).toBe(true);
  });

  it("is empty for a picture with nothing to see", () => {
    expect(paletteOf([])).toEqual([]);
    expect(paletteOf(pixels([10, [0, 0, 0, 0]]))).toEqual([]);
  });

  it("writes hex with two digits a channel", () => {
    expect(toHex([0, 9.6, 255])).toBe("#000aff");
    expect(isHex("#0aF3c1")).toBe(true);
    expect(isHex("#fff")).toBe(false);
    expect(isHex(12)).toBe(false);
  });
});
