import type { InternalNode } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { bodyOf, FAN_ASIDE, PILE, portCentreOf, stackLabelBelow, stackLabelRow, stackLabelScale, titleLines } from "./body";

const stack = (title: string, description?: string) =>
  ({
    id: "s",
    type: "stack",
    data: { title, description, items: [] },
    measured: { width: PILE, height: PILE + stackLabelRow({ description }) },
    internals: { positionAbsolute: { x: 0, y: 0 } },
  }) as unknown as InternalNode;

describe("a stack's body", () => {
  it("is the pile; at full size its label ends where React Flow measured it", () => {
    const b = bodyOf(stack("Red string"), 1);
    expect(b.h).toBe(PILE);
    expect(PILE + b.below!).toBeCloseTo(PILE + stackLabelRow({}), 5);
  });

  it("reaches further down as the title grows zoomed out", () => {
    expect(stackLabelBelow({ title: "Red string" }, 0.35)).toBeGreaterThan(stackLabelBelow({ title: "Red string" }, 1));
    expect(stackLabelScale(0.35)).toBeCloseTo(0.96 / 0.35, 5);
    expect(stackLabelScale(0.1)).toBe(3.4);
  });

  it("counts a second line once a long title wraps", () => {
    expect(titleLines(110, 1)).toBe(1);
    expect(titleLines(110, 0.3)).toBe(2);
  });

  it("counts the description only while the detail shows", () => {
    const withLine = { title: "Blue", description: "What they own" };
    expect(stackLabelBelow(withLine, 1)).toBeGreaterThan(stackLabelBelow({ title: "Blue" }, 1));
    expect(stackLabelBelow(withLine, 0.4)).toBe(stackLabelBelow({ title: "Blue" }, 0.4));
  });
});

describe("a stack's ports", () => {
  it("put the side pluses out past the fan, level with the pile", () => {
    const n = stack("Motion");
    const left = portCentreOf(n, "left", 1, 10);
    expect(left).toEqual({ x: -FAN_ASIDE - 10, y: PILE / 2 });
    // The fanned cards reach 138 from the centre: the plus is clear of them.
    expect(PILE / 2 - left.x).toBeGreaterThan(138 + 10);
  });

  it("put the bottom plus under the title at every zoom", () => {
    const n = stack("Node canvases");
    for (const z of [1, 0.55, 0.35, 0.2]) {
      const bottom = portCentreOf(n, "bottom", z, 10);
      expect(bottom.y).toBeGreaterThan(PILE + stackLabelBelow({ title: "Node canvases" }, z));
    }
  });
});
