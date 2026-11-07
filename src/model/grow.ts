// Grow: places things that came in without a position (an AI writes what goes
// on the board and what connects to what, and leaves x and y out). Each one
// grows out from what it is wired to, the way a person builds a board: the
// project in the middle, a few things around it each heading its own way, and
// branches that keep going outward from there. Loose on purpose: distances and
// angles vary a little per thing, and nothing is lined up in rows.
//
// Things that already have a position never move. Pure and deterministic, so
// the same file always grows the same way.

import { center, type Rect } from "./stacking";

export type Spot = { id: string; type: string; w: number; h: number; at?: { x: number; y: number } };
export type Tie = { source: string; target: string };

type Point = { x: number; y: number };

/** Where the project goes when the whole board is new. */
export const PROJECT_HOME = { x: -192, y: -96 };
/** How far the first things sit from the project, centre to centre. */
const RING = 448;
/** How far a branch steps out from what it grew from. */
const STEP = 384;
/** The least room between two things. */
const AIR = 64;
/** Boards are seen in a window wider than tall, so they spread wider too. */
const STRETCH = 1.2;
/** Closer than this to another wire on the same thing, and they crowd. */
const CROWD = (40 * Math.PI) / 180;
/** Centres this close on one axis read as a row or a column. */
const LINED_UP = 24;

const deg = Math.PI / 180;
const snap = (v: number, g: number) => Math.round(v / g) * g + 0;

/** A steady number in [0, 1) from an id, so each thing has its own small quirk. */
export function quirk(id: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function overlaps(a: Rect, b: Rect, air: number) {
  return a.x < b.x + b.w + air && b.x < a.x + a.w + air && a.y < b.y + b.h + air && b.y < a.y + a.h + air;
}

/** Whether segments pq and rs cross (sharing an end doesn't count). */
function crosses(p: Point, q: Point, r: Point, s: Point) {
  const d = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(r, s, p);
  const d2 = d(r, s, q);
  const d3 = d(p, q, r);
  const d4 = d(p, q, s);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Positions (top-left, on the grid) for every spot without one. Spots that
 * have a position are returned unchanged.
 */
export function grow(spots: Spot[], ties: Tie[], grid: number): Map<string, Point> {
  const rects = new Map<string, Rect>();
  for (const s of spots) if (s.at) rects.set(s.id, { x: s.at.x, y: s.at.y, w: s.w, h: s.h });
  const out = new Map<string, Point>();
  for (const [id, r] of rects) out.set(id, { x: r.x, y: r.y });
  const free = spots.filter((s) => !s.at);
  if (!free.length) return out;

  const order = new Map(spots.map((s, i) => [s.id, i]));
  const near = new Map<string, string[]>(spots.map((s) => [s.id, []]));
  for (const t of ties) {
    if (t.source === t.target || !near.has(t.source) || !near.has(t.target)) continue;
    near.get(t.source)!.push(t.target);
    near.get(t.target)!.push(t.source);
  }

  const project = spots.find((s) => s.type === "project");
  if (project && !project.at) place(project, rects.size ? null : PROJECT_HOME);
  const { aims: aim, owner } = project ? branchAims(project.id, spots, near, rects) : { aims: new Map<string, number>(), owner: new Map<string, string>() };
  const middle = () => (project && rects.has(project.id) ? center(rects.get(project.id)!) : null);

  // How many wires a placed thing is from the project, so the board grows ring by ring.
  const depth = () => {
    const d = new Map<string, number>();
    const start = project && rects.has(project.id) ? [project.id] : [...rects.keys()];
    const queue = [...start];
    for (const id of start) d.set(id, 0);
    while (queue.length) {
      const id = queue.shift()!;
      for (const n of near.get(id)!) {
        if (d.has(n) || !rects.has(n)) continue;
        d.set(n, d.get(id)! + 1);
        queue.push(n);
      }
    }
    return d;
  };

  for (;;) {
    const left = free.filter((s) => !rects.has(s.id));
    if (!left.length) break;
    const d = depth();
    // Next: the thing whose placed neighbour is closest to the project; then the file's order.
    let best: { spot: Spot; from: string | null; rank: number } | null = null;
    for (const s of left) {
      const placed = near.get(s.id)!.filter((n) => rects.has(n));
      if (!placed.length) continue;
      const from = placed.reduce((a, b) => ((d.get(a) ?? 99) <= (d.get(b) ?? 99) ? a : b));
      const rank = (d.get(from) ?? 99) * 1e6 + order.get(s.id)!;
      if (!best || rank < best.rank) best = { spot: s, from, rank };
    }
    if (best) place(best.spot, null, best.from);
    else place(left[0], null, project && rects.has(project.id) ? project.id : null);
  }
  return out;

  function wiresNow(): [Point, Point, string, string][] {
    const seen: [Point, Point, string, string][] = [];
    for (const t of ties) {
      const a = rects.get(t.source);
      const b = rects.get(t.target);
      if (a && b && t.source !== t.target) seen.push([center(a), center(b), t.source, t.target]);
    }
    return seen;
  }

  function place(s: Spot, fixed: Point | null, fromId: string | null = null) {
    if (fixed) {
      const at = { x: snap(fixed.x, grid), y: snap(fixed.y, grid) };
      rects.set(s.id, { ...at, w: s.w, h: s.h });
      out.set(s.id, at);
      return;
    }
    const from = fromId ? rects.get(fromId) : undefined;
    if (!from || !fromId) {
      // Nothing to grow from: the first free spot to the right of everything.
      const all = [...rects.values()];
      const right = all.length ? Math.max(...all.map((r) => r.x + r.w)) + AIR * 2 : PROJECT_HOME.x;
      const top = all.length ? Math.min(...all.map((r) => r.y)) : PROJECT_HOME.y;
      const at = { x: snap(right, grid), y: snap(top, grid) };
      rects.set(s.id, { ...at, w: s.w, h: s.h });
      out.set(s.id, at);
      return;
    }

    const c = center(from);
    const mid = middle();
    const isHub = !mid || fromId === project?.id || Math.hypot(c.x - mid.x, c.y - mid.y) < 1;
    // A branch keeps heading the way it already goes: away from the project.
    const outward = isHub || !mid ? null : Math.atan2(c.y - mid.y, (c.x - mid.x) / STRETCH);
    const lean = (quirk(s.id, 1) - 0.5) * 30 * deg;
    const reach = (isHub ? RING : STEP) + (quirk(s.id, 2) - 0.35) * 128;
    // Angles already taken by wires on the thing it grows from.
    const taken: number[] = [];
    for (const n of near.get(fromId)!) {
      const r = rects.get(n);
      if (!r || n === s.id) continue;
      const p = center(r);
      taken.push(Math.atan2(p.y - c.y, (p.x - c.x) / STRETCH));
    }
    const wires = wiresNow();
    const others = [...rects.entries()].filter(([id]) => id !== fromId);

    let pick: { at: Point; score: number } | null = null;
    for (let ring = 0; ring < 8 && !pick; ring++) {
      const far = reach + ring * 96;
      for (let k = 0; k < 36; k++) {
        const a = outward === null ? k * 10 * deg : outward + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10 * deg + lean;
        if (outward !== null && k > 18) break;
        const cx = c.x + Math.cos(a) * far * STRETCH;
        const cy = c.y + Math.sin(a) * far;
        const at = { x: snap(cx - s.w / 2, grid), y: snap(cy - s.h / 2, grid) };
        const box = { ...at, w: s.w, h: s.h };
        if ([...rects.values()].some((r) => overlaps(box, r, AIR))) continue;
        const p = center(box);

        let score = ring * 40;
        // Wires that would cross the ones already there.
        for (const n of near.get(s.id)!) {
          const r = rects.get(n);
          if (!r) continue;
          const q = center(r);
          for (const [w1, w2, a1, a2] of wires) {
            if (a1 === n || a2 === n) continue;
            if (crosses(p, q, w1, w2)) score += 1000;
          }
          // A wire passing through something else on the board.
          for (const [id, r2] of others) {
            if (id === n) continue;
            if (segmentHitsRect(p, q, r2)) score += 600;
          }
        }
        // Close to the other things it is wired to, so their wires stay short.
        for (const n of near.get(s.id)!) {
          const r = rects.get(n);
          if (!r || n === fromId) continue;
          const q = center(r);
          score += Math.hypot((q.x - p.x) / STRETCH, q.y - p.y) * 0.6;
        }
        // On a new board, lean toward the branch something not placed yet belongs to, so the wire to it won't cut across.
        const hub = mid ?? c;
        for (const n of aim.has(s.id) ? [] : near.get(s.id)!) {
          const b = owner.get(n);
          if (rects.has(n) || !b || b === owner.get(s.id)) continue;
          const a = aim.get(b)!;
          const g = { x: hub.x + Math.cos(a) * (RING + STEP) * STRETCH, y: hub.y + Math.sin(a) * (RING + STEP) };
          score += Math.hypot((g.x - p.x) / STRETCH, g.y - p.y) * 0.8;
        }
        // Crowding the wires already on the thing it grows from.
        const mine = Math.atan2(p.y - c.y, (p.x - c.x) / STRETCH);
        for (const t of taken) {
          const gap = angleGap(mine, t);
          if (gap < CROWD) score += (CROWD - gap) / deg * 20;
        }
        const target = isHub ? aim.get(s.id) : undefined;
        if (target !== undefined) {
          // A new board: each branch heads the way it was given (see branchAims).
          score += (angleGap(mine, target) / deg) * 6;
        } else if (outward === null) {
          // Around the project: take the widest open gap.
          const nearest = taken.length ? Math.min(...taken.map((t) => angleGap(mine, t))) : Math.PI;
          score -= (nearest / deg) * 4;
          // The very first one heads its own way, so new boards don't all start alike.
          score += (angleGap(mine, quirk(s.id, 3) * Math.PI * 2) / deg) * 0.2;
        } else {
          score += (angleGap(mine, outward + lean) / deg) * 3;
        }
        // Lined up with something nearby reads as a grid.
        for (const [, r2] of others) {
          const q = center(r2);
          if (Math.hypot(q.x - p.x, q.y - p.y) > 900) continue;
          if (Math.abs(q.x - p.x) < LINED_UP || Math.abs(q.y - p.y) < LINED_UP) score += 120;
        }
        if (!pick || score < pick.score) pick = { at, score };
      }
    }
    const at = pick?.at ?? { x: snap(c.x + reach * STRETCH, grid), y: snap(c.y, grid) };
    rects.set(s.id, { ...at, w: s.w, h: s.h });
    out.set(s.id, at);
  }
}

/**
 * For a new board (nothing wired to the project placed yet): which way each
 * branch off the project heads. Branches wired to each other go side by side,
 * so the wires between them stay short, and a branch with more on it gets a
 * wider share of the circle.
 */
function branchAims(projectId: string, spots: Spot[], near: Map<string, string[]>, rects: Map<string, Rect>) {
  const aims = new Map<string, number>();
  const branchOf = new Map<string, string>();
  const none = { aims, owner: branchOf };
  if (!rects.has(projectId) || near.get(projectId)!.some((n) => rects.has(n))) return none;
  const firsts = [...new Set(near.get(projectId)!)].filter((n) => !rects.has(n));
  if (!firsts.length) return none;

  // Which branch everything belongs to: the first one to reach it.
  const owner = new Map<string, number>(firsts.map((id, i) => [id, i]));
  const queue = [...firsts];
  while (queue.length) {
    const id = queue.shift()!;
    for (const n of near.get(id)!) {
      if (n === projectId || owner.has(n) || rects.has(n)) continue;
      owner.set(n, owner.get(id)!);
      queue.push(n);
    }
  }
  const size = firsts.map(() => 1);
  for (const [id, b] of owner) if (!firsts.includes(id)) size[b] += 1;
  const tie = firsts.map(() => firsts.map(() => 0));
  for (const s of spots) {
    for (const n of near.get(s.id)!) {
      const a = owner.get(s.id);
      const b = owner.get(n);
      if (a !== undefined && b !== undefined && a !== b) tie[a][b] += 1;
    }
  }

  // The round order that puts the most wired-together branches next to each other.
  const order = bestRing(firsts.length, tie);
  const share = order.map((b) => Math.sqrt(size[b]) + 1);
  const total = share.reduce((a, b) => a + b, 0);
  let at = quirk(projectId, 5) * Math.PI * 2;
  order.forEach((b, i) => {
    const slice = (share[i] / total) * Math.PI * 2;
    aims.set(firsts[b], at + slice / 2 + (quirk(firsts[b], 6) - 0.5) * slice * 0.3);
    at += slice;
  });
  for (const [id, b] of owner) branchOf.set(id, firsts[b]);
  return { aims, owner: branchOf };
}

/** A round order of n branches that keeps the most ties between neighbours. */
function bestRing(n: number, tie: number[][]): number[] {
  const score = (o: number[]) => o.reduce((sum, b, i) => sum + tie[b][o[(i + 1) % o.length]], 0);
  const start = [...Array(n).keys()];
  if (n <= 3 || n > 8) return start;
  let best = start;
  let top = score(start);
  // The first stays first: rings that only turn are the same ring.
  const walk = (o: number[], rest: number[]) => {
    if (!rest.length) {
      const v = score(o);
      if (v > top) [best, top] = [o, v];
      return;
    }
    for (const r of rest) walk([...o, r], rest.filter((x) => x !== r));
  };
  walk([0], start.slice(1));
  return best;
}

/** Whether the segment pq passes through the rect r. */
function segmentHitsRect(p: Point, q: Point, r: Rect) {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const x = p.x + ((q.x - p.x) * i) / steps;
    const y = p.y + ((q.y - p.y) * i) / steps;
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  }
  return false;
}
