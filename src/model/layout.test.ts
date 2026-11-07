import { describe, expect, it } from "vitest";
import { countCrossings, tidy, type LayoutEdge, type LayoutNode, type Placement } from "./layout";
import { areaAround, areaOwners, insideArea } from "./operations";

const G = 32;
const node = (id: string, type: string, x: number, y: number, w = 200, h = 160): LayoutNode => ({ id, type, x, y, w, h });
const wire = (source: string, target: string): LayoutEdge => ({ source, target });
const centres = (p: Map<string, Placement>) => new Map([...p].map(([id, r]) => [id, { x: r.x + r.w / 2, y: r.y + r.h / 2 }]));
const centresOf = (ns: LayoutNode[]) => new Map(ns.map((n) => [n.id, { x: n.x + n.w / 2, y: n.y + n.h / 2 }]));

/** Four hubs around the project, each with three leaves, every leaf put on the far side of the board. */
function tangled() {
  const nodes = [node("project", "project", 0, 0, 340, 160)];
  const edges: LayoutEdge[] = [];
  const hubAt = [[600, 0], [0, 600], [-600, 0], [0, -600]];
  hubAt.forEach(([x, y], h) => {
    nodes.push(node(`h${h}`, "note", x, y, 260, 120));
    edges.push(wire("project", `h${h}`));
    for (let k = 0; k < 3; k++) {
      const [ox, oy] = hubAt[(h + 2) % 4];
      nodes.push(node(`h${h}-${k}`, "card", ox * 1.6 + k * 230 - 230, oy * 1.6 + k * 40, 180, 180));
      edges.push(wire(`h${h}`, `h${h}-${k}`));
    }
  });
  return { nodes, edges };
}

/** A mixed board: sizes vary, some wires form loops, two things are wired to nothing. */
function mixed() {
  const nodes = [node("project", "project", -170, -80, 340, 170)];
  const edges: LayoutEdge[] = [];
  for (let i = 0; i < 18; i++) {
    const w = [180, 260, 300, 200][i % 4];
    const h = [180, 140, 230, 260][i % 3];
    nodes.push(node(`n${i}`, i % 3 ? "stack" : "note", ((i * 377) % 1900) - 950, ((i * 613) % 1300) - 650, w, h));
    edges.push(wire(i < 5 ? "project" : `n${(i * 7) % 5}`, `n${i}`));
  }
  edges.push(wire("n7", "n12"), wire("n3", "n9"));
  nodes.push(node("lone1", "card", 900, 900), node("lone2", "note", -900, 700, 260, 120));
  return { nodes, edges };
}

/** Pairs closer than two grid units, skipping an area and its own members. */
function crowded(p: Map<string, Placement>, owners: Map<string, string>) {
  const ids = [...p.keys()];
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = [ids[i], ids[j]];
      if (owners.get(a) === b || owners.get(b) === a) continue;
      const r = p.get(a)!;
      const s = p.get(b)!;
      const gap = 2 * G;
      if (r.x < s.x + s.w + gap && s.x < r.x + r.w + gap && r.y < s.y + s.h + gap && s.y < r.y + r.h + gap) out.push(`${a}/${b}`);
    }
  }
  return out;
}

describe("tidy", () => {
  it("untangles a board full of crossing wires", () => {
    const { nodes, edges } = tangled();
    const before = countCrossings(centresOf(nodes), edges);
    const after = countCrossings(centres(tidy(nodes, edges, G)), edges);
    expect(before).toBeGreaterThan(10);
    expect(after).toBeLessThan(before);
    expect(after).toBe(0);
  });

  it("leaves nothing overlapping, with two grid units between things", () => {
    for (const { nodes, edges } of [tangled(), mixed()]) {
      expect(crowded(tidy(nodes, edges, G), new Map())).toEqual([]);
    }
  });

  it("keeps the project where it is and puts everything else on the grid", () => {
    const { nodes, edges } = mixed();
    const out = tidy(nodes, edges, G);
    expect(out.get("project")).toEqual({ x: -170, y: -80, w: 340, h: 170 });
    for (const [id, p] of out) {
      if (id === "project") continue;
      expect([p.x % G, p.y % G].map(Math.abs)).toEqual([0, 0]);
    }
  });

  it("puts things wired to nothing in a row below the rest", () => {
    const { nodes, edges } = mixed();
    const out = tidy(nodes, edges, G);
    const wired = [...out].filter(([id]) => !id.startsWith("lone")).map(([, p]) => p.y + p.h);
    const [a, b] = [out.get("lone1")!, out.get("lone2")!];
    expect(Math.min(a.y, b.y)).toBeGreaterThan(Math.max(...wired));
    expect(a.y).toBe(b.y);
    expect(b.x).toBeLessThan(a.x); // lone2 sat further left
  });

  it("is deterministic", () => {
    const { nodes, edges } = mixed();
    expect([...tidy(nodes, edges, G)]).toEqual([...tidy(nodes, edges, G)]);
  });

  it("places the first ring on the side of the project it was on", () => {
    const nodes = [node("project", "project", 0, 0), node("right", "note", 900, 0), node("left", "note", -900, 0)];
    const out = tidy(nodes, [wire("project", "right"), wire("project", "left")], G);
    expect(out.get("right")!.x).toBeGreaterThan(0);
    expect(out.get("left")!.x).toBeLessThan(0);
  });

  it("keeps an area's members together inside it, and moves the area with them", () => {
    const { nodes, edges } = mixed();
    const area = node("area", "area", 1600, 1600, 640, 480);
    const members = [node("m1", "card", 1640, 1640, 180, 180), node("m2", "card", 1900, 1700, 180, 180), node("m3", "note", 1640, 1900, 260, 120)];
    edges.push(wire("project", "m1"), wire("m2", "n4"));
    const all = [...nodes, area, ...members];
    const out = tidy(all, edges, G);
    const a = out.get("area")!;
    expect(a.w % G).toBe(0);
    expect(a.h % G).toBe(0);
    for (const m of members) expect(insideArea(a, out.get(m.id)!)).toBe(true);
    expect(crowded(out, areaOwners(all))).toEqual([]);
    expect(Math.hypot(a.x - 1600, a.y - 1600)).toBeGreaterThan(200);
  });

  it("keeps the project still when it sits in an area", () => {
    const nodes = [node("area", "area", -64, -64, 800, 400), node("project", "project", 0, 0, 340, 160), node("n", "note", 400, 0), node("o", "note", 900, 900)];
    const out = tidy(nodes, [wire("project", "o")], G);
    expect(out.get("project")).toMatchObject({ x: 0, y: 0 });
    expect(insideArea(out.get("area")!, out.get("n")!)).toBe(true);
  });

  it("copes with an empty board and one without a project", () => {
    expect(tidy([], [], G).size).toBe(0);
    const out = tidy([node("a", "note", 10, 10), node("b", "note", 500, 500)], [wire("a", "b")], G);
    expect(crowded(out, new Map())).toEqual([]);
  });
});

describe("areas", () => {
  it("wraps things in an area on the grid with at least one grid unit of room", () => {
    const r = areaAround([{ x: 10, y: 20, w: 200, h: 100 }, { x: 300, y: 250, w: 100, h: 100 }], G);
    expect([r.x, r.y, r.w, r.h].map((v) => Math.abs(v % G))).toEqual([0, 0, 0, 0]);
    expect(r.x).toBeLessThanOrEqual(10 - G);
    expect(r.y).toBeLessThanOrEqual(20 - G);
    expect(r.x + r.w).toBeGreaterThanOrEqual(400 + G);
    expect(r.y + r.h).toBeGreaterThanOrEqual(350 + G);
  });

  it("counts a thing as inside when its centre is", () => {
    const area = { x: 0, y: 0, w: 400, h: 300 };
    expect(insideArea(area, { x: 300, y: 200, w: 180, h: 180 })).toBe(true);
    expect(insideArea(area, { x: 330, y: 200, w: 180, h: 180 })).toBe(false);
  });

  it("gives a thing in two areas to the smaller one", () => {
    const owners = areaOwners([node("big", "area", 0, 0, 1000, 1000), node("small", "area", 0, 0, 400, 400), node("c", "card", 100, 100)]);
    expect(owners.get("c")).toBe("small");
    expect(owners.has("small")).toBe(false);
  });
});
