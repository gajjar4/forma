// Pure maths for the grid effects: the dot "+" that marks a port and the dot
// wire you pull out of one. Everything here is in board units unless named
// otherwise, so it can be tested without a screen.

export type Pt = { x: number; y: number };
export type Side = "top" | "right" | "bottom" | "left";
export type Cubic = readonly [Pt, Pt, Pt, Pt];
export type Spring = { k: number; c: number };

export const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

const OUT: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** The midpoint of a rect's side, pushed `out` units away from the rect. */
export function portCentre(r: { x: number; y: number; w: number; h: number }, side: Side, out: number): Pt {
  const o = OUT[side];
  return { x: r.x + r.w / 2 + o.x * (r.w / 2 + out), y: r.y + r.h / 2 + o.y * (r.h / 2 + out) };
}

/** A "+" of five dots, centre first, then the arms clockwise from the top. */
export function plusOffsets(arm: number): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: 0, y: -arm },
    { x: arm, y: 0 },
    { x: 0, y: arm },
    { x: -arm, y: 0 },
  ];
}

/** The four points of the cubic in an `M x y C x y x y x y` path, as `wirePath` writes it. */
export function cubicFromPath(path: string): Cubic | null {
  const n = path.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number);
  if (!n || n.length < 8 || n.some((v) => !Number.isFinite(v))) return null;
  return [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
  ];
}

function bezier([a, b, c, d]: Cubic, t: number): Pt {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return { x: w0 * a.x + w1 * b.x + w2 * c.x + w3 * d.x, y: w0 * a.y + w1 * b.y + w2 * c.y + w3 * d.y };
}

/**
 * Points along a curve at even arc-length spacing: the first at `start`, then
 * every `step`, stopping short of the end, and the end itself last. So point
 * `k` keeps its place on the wire as the wire grows, and new points only ever
 * appear at the far end.
 */
export function sampleEvenly(curve: Cubic, step: number, start = step, segments = 64): Pt[] {
  const pts: Pt[] = [curve[0]];
  const lens = [0];
  for (let i = 1; i <= segments; i++) {
    const p = bezier(curve, i / segments);
    const q = pts[i - 1];
    pts.push(p);
    lens.push(lens[i - 1] + Math.hypot(p.x - q.x, p.y - q.y));
  }
  const total = lens[segments];
  const out: Pt[] = [];
  if (!(step > 0) || total <= 0) return [curve[3]];
  let seg = 1;
  for (let d = start; d < total - step * 0.5; d += step) {
    while (seg < segments && lens[seg] < d) seg++;
    const span = lens[seg] - lens[seg - 1] || 1;
    const f = (d - lens[seg - 1]) / span;
    const a = pts[seg - 1];
    const b = pts[seg];
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  out.push(curve[3]);
  return out;
}

/** One number per grid dot, so a set of borrowed dots is cheap to check. */
export const dotKey = (i: number, j: number) => (i + 1048576) * 2097152 + (j + 1048576);
/** The grid indices back from a `dotKey`. */
export const dotFromKey = (key: number) => ({
  i: Math.floor(key / 2097152) - 1048576,
  j: (key % 2097152) - 1048576,
});

/**
 * The grid dot nearest to `p` that `free` allows, within `reach`. Grid dots
 * sit at `(i * grid, j * grid)`. Returns null when none is free in reach.
 */
export function nearestFreeDot(p: Pt, grid: number, reach: number, free: (i: number, j: number) => boolean) {
  const ci = Math.round(p.x / grid);
  const cj = Math.round(p.y / grid);
  const r = Math.ceil(reach / grid);
  const reach2 = reach * reach;
  let best: { i: number; j: number } | null = null;
  let bestD = Infinity;
  for (let j = cj - r; j <= cj + r; j++) {
    const dy = j * grid - p.y;
    for (let i = ci - r; i <= ci + r; i++) {
      const dx = i * grid - p.x;
      const d = dx * dx + dy * dy;
      if (d > reach2 || d >= bestD || !free(i, j)) continue;
      best = { i, j };
      bestD = d;
    }
  }
  return best;
}

/**
 * One step of a damped spring pulling `x` towards `to`. Sub-stepped so a slow
 * frame never blows it up. Returns the new position and velocity.
 */
export function springStep(x: number, v: number, to: number, s: Spring, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += (-s.k * (x - to) - s.c * v) * h;
    x += v * h;
  }
  return [x, v];
}
