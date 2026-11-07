// Tidy: arranges the board around the project so wires are short and don't
// cross. Pure and deterministic, so the same board always tidies the same way.
//
// The project stays put. Everything wired to it goes in a ring around it,
// what is wired to those goes in the next ring out, and so on. Each thing in
// the first ring gets a slice of the circle sized by how much hangs off it,
// and what hangs off it stays inside that slice, so the tree of wires never
// crosses. Siblings keep the order they had on the board, then swap only
// where that removes crossings. Things wired to nothing go in a row below.
// An area moves as one block with its members laid out in rows inside it.

import { areaOwners, packArea, type Thing } from "./operations";
import { center, type Rect } from "./stacking";

export type LayoutNode = Thing;
export type LayoutEdge = { source: string; target: string };
export type Placement = { x: number; y: number; w: number; h: number };

type Point = { x: number; y: number };
/** One thing the ring layout moves: a loose node, or an area with its members. */
type Block = { id: string; x: number; y: number; w: number; h: number; members: { id: string; dx: number; dy: number }[] };

const TAU = Math.PI * 2;
/** The widest slice one thing in the first ring may spread what hangs off it over. */
const MAX_SPREAD = (TAU * 3) / 8;
/** Rings are wider than tall, like the window they are seen in. */
const STRETCH = 1.3;

const snapUp = (v: number, g: number) => Math.ceil(v / g - 1e-9) * g;
const snap = (v: number, g: number) => Math.round(v / g) * g + 0;
const mid = (r: Rect): Point => center(r);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Half a rect's size along a direction, measured in the unstretched ring space. */
function halfAlong(b: Block, a: number) {
  return (Math.abs(Math.cos(a)) * b.w) / STRETCH / 2 + (Math.abs(Math.sin(a)) * b.h) / 2;
}

/** How many pairs of wires cross, drawing each wire straight between centres. */
export function countCrossings(at: Map<string, Point>, edges: LayoutEdge[]) {
  const segs = edges.flatMap((e) => {
    const a = at.get(e.source);
    const b = at.get(e.target);
    return a && b && e.source !== e.target ? [{ e, a, b }] : [];
  });
  let n = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i];
      const t = segs[j];
      if (s.e.source === t.e.source || s.e.source === t.e.target || s.e.target === t.e.source || s.e.target === t.e.target) continue;
      if (crosses(s.a, s.b, t.a, t.b)) n++;
    }
  }
  return n;
}

function crosses(p: Point, q: Point, r: Point, s: Point) {
  const d = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return d(p, q, r) * d(p, q, s) < 0 && d(r, s, p) * d(r, s, q) < 0;
}

function overlaps(a: Block, b: Block, gap: number) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/**
 * New places for things on the board. Returns a placement for every node
 * (areas include their new size). Sizes and positions are in board units;
 * everything but the project lands on the grid.
 */
export function tidy(nodes: LayoutNode[], edges: LayoutEdge[], grid: number): Map<string, Placement> {
  const gap = grid * 2;
  const owner = areaOwners(nodes);
  const blocks: Block[] = [];
  for (const n of nodes) {
    if (n.type === "area") {
      const packed = packArea(n, nodes.filter((m) => owner.get(m.id) === n.id), grid, gap);
      blocks.push({ id: n.id, x: n.x, y: n.y, w: packed.w, h: packed.h, members: [{ id: n.id, dx: 0, dy: 0 }, ...packed.members] });
    }
    else if (!owner.has(n.id)) blocks.push({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, members: [{ id: n.id, dx: 0, dy: 0 }] });
  }
  const blockOf = new Map<string, Block>();
  for (const b of blocks) for (const m of b.members) blockOf.set(m.id, b);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Wires between blocks, once each, never from a block to itself.
  const links = new Map<string, Set<string>>(blocks.map((b) => [b.id, new Set()]));
  const blockEdges: LayoutEdge[] = [];
  for (const e of edges) {
    const a = blockOf.get(e.source)?.id;
    const b = blockOf.get(e.target)?.id;
    if (!a || !b || a === b || links.get(a)!.has(b)) continue;
    links.get(a)!.add(b);
    links.get(b)!.add(a);
    blockEdges.push({ source: a, target: b });
  }

  const project = nodes.find((n) => n.type === "project");
  const busiest = [...blocks].sort((a, b) => links.get(b.id)!.size - links.get(a.id)!.size || byId(a, b))[0];
  const root = project ? blockOf.get(project.id)! : busiest && links.get(busiest.id)!.size ? busiest : undefined;

  // Where the root's block goes: the project keeps its exact place.
  if (root && project && root.id !== project.id) {
    const m = root.members.find((k) => k.id === project.id)!;
    root.x = project.x - m.dx;
    root.y = project.y - m.dy;
  }
  const rc = root ? mid(root) : { x: 0, y: 0 };
  const angleNow = (b: Block) => {
    const c = mid(b);
    return Math.atan2(c.y - rc.y, (c.x - rc.x) / STRETCH);
  };

  // Rings by wire distance from the root. The first block to reach a thing becomes its parent.
  const depth = new Map<string, number>();
  const kids = new Map<string, string[]>();
  const order: string[] = [];
  if (root) {
    depth.set(root.id, 0);
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      const near = [...links.get(id)!].filter((k) => !depth.has(k));
      const parentAngle = id === root.id ? 0 : angleNow(blockOf.get(id)!);
      near.sort((a, b) => wrap(angleNow(blockOf.get(a)!) - parentAngle) - wrap(angleNow(blockOf.get(b)!) - parentAngle) || (a < b ? -1 : 1));
      kids.set(id, near);
      for (const k of near) {
        depth.set(k, depth.get(id)! + 1);
        queue.push(k);
      }
    }
  }
  const weight = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const ks = kids.get(id)!;
    weight.set(id, ks.length ? ks.reduce((s, k) => s + weight.get(k)!, 0) : 1);
  }

  /** Centres for every block in the rings, for one order of siblings. */
  const arrange = (sib: Map<string, string[]>) => {
    const angle = new Map<string, number>();
    const spread = new Map<string, number>();
    if (!root) return { angle, centre: new Map<string, Point>() };
    const first = sib.get(root.id)!;
    const total = first.reduce((s, k) => s + weight.get(k)!, 0);
    let a = 0;
    for (const k of first) {
      const s = (TAU * weight.get(k)!) / total;
      angle.set(k, a + s / 2);
      spread.set(k, Math.min(s, MAX_SPREAD));
      a += s;
    }
    // Turn the whole ring so the first ring sits about where it was.
    let sin = 0;
    let cos = 0;
    for (const k of first) {
      const d = angleNow(blockOf.get(k)!) - angle.get(k)!;
      sin += Math.sin(d);
      cos += Math.cos(d);
    }
    const turn = first.length ? Math.atan2(sin, cos) : 0;
    for (const k of first) angle.set(k, angle.get(k)! + turn);
    for (const id of order) {
      if (id === root.id) continue;
      const ks = sib.get(id)!;
      const sum = ks.reduce((s, k) => s + weight.get(k)!, 0);
      let at = angle.get(id)! - spread.get(id)! / 2;
      for (const k of ks) {
        const s = (spread.get(id)! * weight.get(k)!) / sum;
        angle.set(k, at + s / 2);
        spread.set(k, s);
        at += s;
      }
    }

    // Each thing sits just far enough out to clear what it hangs off, and far
    // enough for room beside its neighbours in the same ring. Per thing, not
    // per ring, so one big block doesn't push every other wire long.
    const parent = new Map<string, string>();
    for (const id of order) for (const k of sib.get(id)!) parent.set(k, id);
    const rad = new Map<string, number>([[root.id, 0]]);
    const rings: Block[][] = [];
    for (const id of order) (rings[depth.get(id)!] ??= []).push(blockOf.get(id)!);
    const across = (b: Block) => halfAlong(b, angle.get(b.id)! + Math.PI / 2);
    for (let d = 1; d < rings.length; d++) {
      for (const b of rings[d]) {
        const phi = angle.get(b.id)!;
        const up = blockOf.get(parent.get(b.id)!)!;
        rad.set(b.id, rad.get(up.id)! + halfAlong(up, phi) + halfAlong(b, phi) + gap);
      }
      const ring = [...rings[d]].sort((p, q) => angle.get(p.id)! - angle.get(q.id)!);
      for (let i = 0; i < ring.length && ring.length > 1; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        const delta = (((angle.get(q.id)! - angle.get(p.id)!) % TAU) + TAU) % TAU;
        if (delta >= Math.PI) continue;
        const need = (across(p) + across(q) + gap) / (2 * Math.sin(Math.max(delta, 0.05) / 2));
        rad.set(p.id, Math.max(rad.get(p.id)!, need));
        rad.set(q.id, Math.max(rad.get(q.id)!, need));
      }
    }
    const centre = new Map<string, Point>([[root.id, rc]]);
    for (const id of order) {
      if (id === root.id) continue;
      const r = rad.get(id)!;
      const phi = angle.get(id)!;
      centre.set(id, { x: rc.x + STRETCH * r * Math.cos(phi), y: rc.y + r * Math.sin(phi) });
    }
    return { angle, centre };
  };

  // Keep the board's own order of siblings; swap neighbours only when it removes crossings.
  const sib = new Map(kids);
  let best = countCrossings(arrange(sib).centre, blockEdges);
  for (let pass = 0; pass < 4 && best > 0; pass++) {
    let better = false;
    for (const id of order) {
      const ks = [...sib.get(id)!];
      for (let i = 0; i + 1 < ks.length; i++) {
        [ks[i], ks[i + 1]] = [ks[i + 1], ks[i]];
        sib.set(id, [...ks]);
        const n = countCrossings(arrange(sib).centre, blockEdges);
        if (n < best) {
          best = n;
          better = true;
        } else {
          [ks[i], ks[i + 1]] = [ks[i + 1], ks[i]];
          sib.set(id, [...ks]);
        }
      }
    }
    if (!better) break;
  }
  const { angle, centre } = arrange(sib);

  // Onto the grid, then out along its own direction until nothing is in the way.
  const placed: Block[] = [];
  for (const id of order) {
    const b = blockOf.get(id)!;
    if (b !== root) {
      const c = centre.get(id)!;
      b.x = snap(c.x - b.w / 2, grid);
      b.y = snap(c.y - b.h / 2, grid);
      const phi = angle.get(id)!;
      const step = { x: Math.round(Math.cos(phi) * 1.5) * grid, y: Math.round(Math.sin(phi) * 1.5) * grid };
      for (let i = 0; i < 400 && placed.some((p) => overlaps(p, b, gap)); i++) {
        b.x += step.x;
        b.y += step.y;
      }
    }
    placed.push(b);
  }

  // Things wired to nothing: a tidy row below, in the order they sat left to right.
  const loose = blocks.filter((b) => !depth.has(b.id)).sort((a, b) => a.x - b.x || a.y - b.y || byId(a, b));
  if (loose.length) {
    const left = placed.length ? Math.min(...placed.map((b) => b.x)) : Math.min(...loose.map((b) => b.x));
    const right = placed.length ? Math.max(...placed.map((b) => b.x + b.w)) : left;
    const top = placed.length ? Math.max(...placed.map((b) => b.y + b.h)) + gap : Math.min(...loose.map((b) => b.y));
    const width = Math.max(right - left, 40 * grid);
    let x = snap(left, grid);
    let y = snapUp(top, grid);
    let rowH = 0;
    for (const b of loose) {
      if (x > snap(left, grid) && x + b.w > left + width) {
        x = snap(left, grid);
        y = snapUp(y + rowH + gap, grid);
        rowH = 0;
      }
      b.x = x;
      b.y = y;
      rowH = Math.max(rowH, b.h);
      x = snapUp(x + b.w + gap, grid);
    }
  }

  const out = new Map<string, Placement>();
  for (const b of blocks) {
    for (const m of b.members) {
      const n = nodeById.get(m.id)!;
      const own = m.id === b.id;
      out.set(m.id, { x: b.x + m.dx, y: b.y + m.dy, w: own ? b.w : n.w, h: own ? b.h : n.h });
    }
  }
  return out;
}
