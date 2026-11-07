import { describe, expect, it } from "vitest";
import { parseBoard } from "./format";
import { grow, PROJECT_HOME, type Spot, type Tie } from "./grow";

const stack = (id: string): Spot => ({ id, type: "stack", w: 200, h: 248 });
const note = (id: string): Spot => ({ id, type: "note", w: 256, h: 120 });
const tie = (source: string, target: string): Tie => ({ source, target });

// A new board as an AI writes it: what goes on it and what connects, no positions.
const spots: Spot[] = [
  { id: "project", type: "project", w: 352, h: 160 },
  note("call"),
  stack("blue"),
  stack("shops"),
  note("rules"),
  stack("type"),
  stack("motion"),
  note("plan"),
  stack("flows"),
  stack("rivals"),
  stack("apps"),
  stack("assistants"),
];
const ties: Tie[] = [
  tie("project", "call"),
  tie("call", "blue"),
  tie("call", "shops"),
  tie("project", "rules"),
  tie("rules", "type"),
  tie("rules", "motion"),
  tie("project", "plan"),
  tie("plan", "flows"),
  tie("project", "rivals"),
  tie("rivals", "apps"),
  tie("rivals", "assistants"),
  tie("blue", "type"),
];

type Box = { x: number; y: number; w: number; h: number };
const boxes = (at: Map<string, { x: number; y: number }>, all: Spot[]) =>
  new Map(all.map((s) => [s.id, { ...at.get(s.id)!, w: s.w, h: s.h }]));
const mid = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const apart = (a: Box, b: Box, air: number) =>
  a.x >= b.x + b.w + air || b.x >= a.x + a.w + air || a.y >= b.y + b.h + air || b.y >= a.y + a.h + air;

function crossings(at: Map<string, Box>, ts: Tie[]) {
  const side = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let n = 0;
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const [p, q, r, s] = [ts[i].source, ts[i].target, ts[j].source, ts[j].target].map((id) => mid(at.get(id)!));
      if (side(r, s, p) * side(r, s, q) < 0 && side(p, q, r) * side(p, q, s) < 0) n++;
    }
  }
  return n;
}

describe("grow", () => {
  const at = grow(spots, ties, 32);
  const placed = boxes(at, spots);

  it("places everything, on the grid, with the project in its usual spot", () => {
    expect(at.size).toBe(spots.length);
    for (const p of at.values()) {
      expect(Math.abs(p.x % 32)).toBe(0);
      expect(Math.abs(p.y % 32)).toBe(0);
    }
    expect(at.get("project")).toEqual(PROJECT_HOME);
  });

  it("leaves room between things", () => {
    const all = [...placed.values()];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(apart(all[i], all[j], 64)).toBe(true);
  });

  it("keeps wires from crossing", () => {
    expect(crossings(placed, ties)).toBe(0);
  });

  it("grows branches outward: what hangs off a thing sits further from the project", () => {
    const c = mid(placed.get("project")!);
    const far = (id: string) => Math.hypot(mid(placed.get(id)!).x - c.x, mid(placed.get(id)!).y - c.y);
    for (const [parent, child] of [
      ["call", "shops"],
      ["rules", "motion"],
      ["plan", "flows"],
      ["rivals", "apps"],
      ["rivals", "assistants"],
    ]) {
      expect(far(child)).toBeGreaterThan(far(parent));
    }
  });

  it("gives each branch off the project its own direction", () => {
    const c = mid(placed.get("project")!);
    const angles = ["call", "rules", "plan", "rivals"]
      .map((id) => Math.atan2(mid(placed.get(id)!).y - c.y, mid(placed.get(id)!).x - c.x))
      .sort((a, b) => a - b);
    const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + Math.PI * 2 - angles[angles.length - 1]));
    expect(Math.min(...gaps)).toBeGreaterThan((40 * Math.PI) / 180);
  });

  it("is the same every time", () => {
    expect([...grow(spots, ties, 32)]).toEqual([...at]);
  });

  it("never moves what already has a place, and grows new things beside what they're wired to", () => {
    const fixed = spots.map((s) => ({ ...s, at: at.get(s.id)! }));
    const more = [...fixed, stack("new")];
    const out = grow(more, [...ties, tie("apps", "new")], 32);
    for (const s of fixed) expect(out.get(s.id)).toEqual(s.at);
    const box = { ...out.get("new")!, w: 200, h: 248 };
    for (const s of fixed) expect(apart(box, { ...s.at, w: s.w, h: s.h }, 64)).toBe(true);
    const from = mid({ ...at.get("apps")!, w: 200, h: 248 });
    expect(Math.hypot(mid(box).x - from.x, mid(box).y - from.y)).toBeLessThan(900);
  });

  it("finds a place for something wired to nothing", () => {
    const out = grow([...spots, note("alone")], ties, 32);
    const box = { ...out.get("alone")!, w: 256, h: 120 };
    for (const b of placed.values()) expect(apart(box, b, 64)).toBe(true);
  });
});

describe("board.json without positions", () => {
  it("places what has no x and y, and keeps what does", () => {
    const board = parseBoard(
      JSON.stringify({
        forma: 1,
        nodes: [
          { id: "project", type: "project", x: 0, y: 0, title: "P", brief: "" },
          { id: "a", type: "note", x: 640, y: 320, text: "Mine" },
          { id: "b", type: "note", text: "From an AI" },
          { id: "c", type: "stack", x: "nope", title: "Also new", items: [] },
        ],
        wires: [
          { id: "w1", from: "project", to: "b" },
          { id: "w2", from: "b", to: "c" },
        ],
      }),
    )!;
    const pos = new Map(board.nodes.map((n) => [n.id, n.position]));
    expect(pos.get("project")).toEqual({ x: 0, y: 0 });
    expect(pos.get("a")).toEqual({ x: 640, y: 320 });
    expect(pos.get("b")).not.toEqual({ x: 0, y: 0 });
    expect(pos.get("c")).not.toEqual({ x: 0, y: 0 });
  });
});
