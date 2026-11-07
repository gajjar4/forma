import type { ReactFlowState } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { sceneWants } from "./gridFx.scene";

const node = (id: string, x: number, y: number) => ({
  id,
  hidden: false,
  dragging: false,
  measured: { width: 200, height: 120 },
  internals: { positionAbsolute: { x, y } },
});

/** Just the parts of React Flow's state the scene reads. */
function state(caught: boolean) {
  const a = node("a", 0, 0);
  const b = node("b", 600, 0);
  return {
    transform: [0, 0, 1],
    nodeLookup: new Map([
      ["a", a],
      ["b", b],
    ]),
    connection: {
      inProgress: true,
      fromNode: a,
      fromPosition: "right",
      from: { x: 210, y: 60 },
      to: caught ? { x: 590, y: 60 } : { x: 560, y: 90 },
      toNode: caught ? b : null,
      toHandle: caught ? { id: "left", nodeId: "b", position: "left" } : null,
    },
  } as unknown as ReactFlowState;
}

describe("a wire caught by a port", () => {
  it("turns that port's plus into the end of the wire", () => {
    const wants = sceneWants(state(true), { hover: "b", port: null, drop: null });
    const melted = [0, 1, 2, 3, 4].map((i) => wants.get(`p:b:left:${i}`));
    expect(melted.every(Boolean)).toBe(true);
    // The caught plus's dots now run along the wire, ending where it lands.
    expect(melted[0]!.x).toBeCloseTo(590, 0);
    expect(melted[4]!.x).toBeLessThan(melted[0]!.x);
    // Its other three pluses still show.
    expect(wants.has("p:b:top:0")).toBe(true);
  });

  it("leaves the plus alone while the wire is still free", () => {
    const wants = sceneWants(state(false), { hover: "b", port: null, drop: null });
    const plus = [0, 1, 2, 3, 4].map((i) => wants.get(`p:b:left:${i}`)!);
    expect(plus.every(Boolean)).toBe(true);
    // A plus: all five dots within a few px of the left port.
    for (const d of plus) expect(Math.abs(d.x - 590)).toBeLessThan(8);
    expect(wants.has("w:head")).toBe(true);
  });
});

describe("a drag from outside", () => {
  it("gathers a plus on the dot it would land on", () => {
    const s = { ...state(false), connection: { inProgress: false } } as unknown as ReactFlowState;
    const wants = sceneWants(s, { hover: null, port: null, drop: { x: 320, y: 192 } });
    const plus = [0, 1, 2, 3, 4].map((i) => wants.get(`p:drop:top:${i}`)!);
    expect(plus.every(Boolean)).toBe(true);
    expect(plus[0]).toMatchObject({ x: 320, y: 192 });
    expect(wants.size).toBe(5);
  });
});
