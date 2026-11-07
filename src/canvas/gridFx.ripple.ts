// A pebble in the dot grid. When something arrives or changes from outside
// the app (an AI, an editor), the grid dots around it darken in a ring that
// widens out from its edges and settles back into the plain grid. Pure maths
// and a small queue here; DotRipples.tsx draws it.

/** A thing's box, in board units. */
export type Rect = { x: number; y: number; w: number; h: number };

/** How long one ripple runs. */
export const RIPPLE_MS = 850;
/** How far the ring travels out from the thing's edge, in board units (about four and a half dots). */
export const REACH = 144;
/** How wide the ring is, in board units: about one dot either side of its front. */
const BAND = 30;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** How far a board point is outside a box (0 on or inside it). */
export function outside(r: Rect, px: number, py: number) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * How much a dot `d` board units out from the edge darkens at `t` (0 to 1 of
 * the ripple): a soft ring whose front runs out from the edge, fading as it
 * goes, so it is gone by the time it reaches its furthest.
 */
export function strength(d: number, t: number) {
  if (t <= 0 || t >= 1) return 0;
  const front = REACH * easeOut(t);
  const k = (d - front) / BAND;
  return Math.exp(-k * k) * (1 - t) ** 1.2;
}

/**
 * The grid dots a ripple touches at `t`, by index, with how much each
 * darkens. Dots under the thing are left out (it covers them). Where two
 * ripples meet, the stronger one shows.
 */
export function rippleDots(r: Rect, t: number, grid: number, into = new Map<string, { i: number; j: number; s: number }>()) {
  const i0 = Math.floor((r.x - REACH) / grid);
  const i1 = Math.ceil((r.x + r.w + REACH) / grid);
  const j0 = Math.floor((r.y - REACH) / grid);
  const j1 = Math.ceil((r.y + r.h + REACH) / grid);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const d = outside(r, i * grid, j * grid);
      if (d === 0) continue;
      const s = strength(d, t);
      if (s < 0.02) continue;
      const key = `${i},${j}`;
      const was = into.get(key);
      if (!was || was.s < s) into.set(key, { i, j, s });
    }
  }
  return into;
}

/** Where every ripple running at `now` reaches: one box around them all, or null when none are. */
export function reachOf(ripples: { rect: Rect }[]): Rect | null {
  if (!ripples.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const { rect: r } of ripples) {
    x0 = Math.min(x0, r.x - REACH);
    y0 = Math.min(y0, r.y - REACH);
    x1 = Math.max(x1, r.x + r.w + REACH);
    y1 = Math.max(y1, r.y + r.h + REACH);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// The ripples running now. One board is on screen at a time.
export type Running = { rect: Rect; start: number };
let running: Running[] = [];
const listeners = new Set<() => void>();

export const ripples = {
  /** The ripples still running at `now`; finished ones are dropped. */
  live(now: number) {
    running = running.filter((r) => now - r.start < RIPPLE_MS);
    return running;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Drops a pebble at this box: the grid ripples out from it. */
export function ripple(rect: Rect) {
  running = [...running, { rect, start: performance.now() }];
  for (const fn of listeners) fn();
}
