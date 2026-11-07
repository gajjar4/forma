import { describe, expect, it } from "vitest";
import { summarise } from "./frames.mjs";

describe("summarise", () => {
  it("passes a steady 60", () => {
    const r = summarise(Array(100).fill(1000 / 60));
    expect(r.fps).toBeCloseTo(60);
    expect(r.slow).toBe(0);
    expect(r.pass).toBe(true);
  });

  it("fails more than 5% of frames over 20ms, even at a good average", () => {
    const r = summarise([...Array(90).fill(15), ...Array(10).fill(21)]);
    expect(r.fps).toBeGreaterThan(55);
    expect(r.slow).toBeCloseTo(0.1);
    expect(r.pass).toBe(false);
  });

  it("fails a low average", () => {
    const r = summarise(Array(50).fill(19));
    expect(r.fps).toBeLessThan(55);
    expect(r.pass).toBe(false);
  });

  it("takes the 95th percentile frame", () => {
    const gaps = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(summarise(gaps).p95).toBe(96);
  });
});
