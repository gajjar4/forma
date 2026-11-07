import { describe, expect, it } from "vitest";
import { cornerAt, handoverAt, liftProgress, shadowAt, shadowOver } from "./elevation";

describe("a lifted thing's height", () => {
  it("runs from 0 at its tile to 1 up close, and holds through the overshoot", () => {
    expect(liftProgress(0.2, 0.2)).toBe(0);
    expect(liftProgress(0.6, 0.2)).toBeCloseTo(0.5);
    expect(liftProgress(1, 0.2)).toBe(1);
    expect(liftProgress(1.04, 0.2)).toBe(1);
    expect(liftProgress(0.18, 0.2)).toBe(0);
    // A tile as big as the lifted box is already up.
    expect(liftProgress(1, 1)).toBe(1);
  });

  it("shows the tile's corner at the tile and the lifted one up close", () => {
    // Set on a box drawn at 0.2, 40px is seen as the tile's 8px.
    expect(cornerAt(0.2, 0.2, 8, 14)).toBeCloseTo(40);
    expect(cornerAt(1, 0.2, 8, 14)).toBeCloseTo(14);
    // Halfway up it is seen halfway between.
    expect(cornerAt(0.6, 0.2, 8, 14) * 0.6).toBeCloseTo(11);
  });

  it("draws a resting shadow on a scaled box so it is seen at its own size", () => {
    const rest = "0 1px 2px rgba(18, 18, 16, 0.06), 0 6px 16px rgba(18, 18, 16, 0.06)";
    expect(shadowOver(rest, 0.5)).toBe("0 2px 4px rgba(18, 18, 16, 0.06), 0 12px 32px rgba(18, 18, 16, 0.06)");
    expect(shadowOver(rest, 1)).toBe(rest);
  });

  it("keeps the lifted shadow nearly full in the air, gone at the tile", () => {
    expect(shadowAt(0.2, 0.2)).toBe(0);
    expect(shadowAt(1, 0.2)).toBe(1);
    expect(shadowAt(0.6, 0.2)).toBeGreaterThan(0.7);
  });

  it("hands over to the tile only over the last of the way home", () => {
    expect(handoverAt(0.6, 0.2)).toBe(1);
    expect(handoverAt(0.2, 0.2)).toBe(0);
    expect(handoverAt(0.2 + 0.8 * 0.006, 0.2)).toBeCloseTo(0.5);
  });
});
