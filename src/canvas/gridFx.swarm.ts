// The dots that leave the grid. Each one is either borrowed (it has a grid
// home it flies out of and back into, and while it is out the grid leaves a
// gap there) or spawned (no free grid dot was near, so it fades in where it is
// wanted and fades out again). Pure logic: the caller says where dots are
// wanted each frame, steps the springs and draws the result.

import { dotKey, nearestFreeDot, springStep, type Spring } from "./gridFx.math";

/** Gathering into a "+" or onto a wire: quick, with a hint of overshoot. */
export const GATHER: Spring = { k: 420, c: 31 };
/** Following the pointer along a wire: a touch stiffer so the wire stays taut. */
export const FOLLOW: Spring = { k: 560, c: 38 };
/** Going home: softer, and settles without bouncing past the grid spot. */
export const HOME: Spring = { k: 210, c: 26 };
/** Size changes (a "+" growing under the pointer) get a small pop. */
const POP: Spring = { k: 520, c: 24 };
/** Reduced motion: no flight, only a fade. */
const FADE: Spring = { k: 260, c: 32 };

export type Want = {
  x: number;
  y: number;
  /** Diameter in screen px once gathered. */
  size: number;
  /** Strength once gathered, as a multiple of the grid dot colour's own alpha. */
  boost: number;
  spring: Spring;
  /** Seconds to wait before leaving the grid. */
  delay?: number;
  /** Wire dots hand over to a nearer grid dot once the wire has moved this far (board units) from home. */
  handoff?: number;
};

export type Env = {
  grid: number;
  /** How far to look for a free grid dot, in board units. */
  reach: number;
  /** False when the grid is too faint to lend dots: spawn instead. */
  borrow: boolean;
  reduced: boolean;
  /** Grid dots that must not be borrowed (hidden under a card). */
  blocked: (i: number, j: number) => boolean;
  /** Board units per screen px, for "close enough" checks. */
  px: number;
};

export type FxDot = {
  home: { i: number; j: number } | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 at home looking like a grid dot, 1 fully gathered. */
  l: number;
  vl: number;
  size: number;
  vsize: number;
  boost: number;
  want: Want | null;
  delay: number;
};

export class DotSwarm {
  readonly dots = new Map<string, FxDot>();
  /** Grid dots that are out of the grid right now. */
  readonly borrowed = new Set<number>();
  private retired = 0;

  get size() {
    return this.dots.size;
  }

  /** Say where dots are wanted this frame. Anything not named heads home. */
  sync(wants: Map<string, Want>, env: Env) {
    for (const [key, d] of this.dots) {
      const w = wants.get(key);
      if (w && d.home && w.handoff && Math.hypot(d.home.i * env.grid - w.x, d.home.j * env.grid - w.y) > w.handoff) {
        this.dots.delete(key);
        this.dots.set(`~${this.retired++}`, d);
        d.want = null;
        continue;
      }
      d.want = w ?? null;
      if (w) d.boost = w.boost;
    }
    for (const [key, w] of wants) {
      if (!this.dots.has(key)) this.dots.set(key, this.create(w, env));
    }
  }

  /**
   * A dot on its way home whose home is still close to `w` can be caught again:
   * it turns around and rejoins from wherever it is, so a wire swinging back
   * and forth keeps using the same real grid dots instead of new ones.
   */
  private reclaim(w: Want, env: Env): FxDot | null {
    const limit = w.handoff ?? env.reach;
    let best: [string, FxDot, number] | null = null;
    for (const [key, d] of this.dots) {
      if (d.want || !d.home) continue;
      if (Math.hypot(d.home.i * env.grid - w.x, d.home.j * env.grid - w.y) > limit) continue;
      const far = Math.hypot(d.x - w.x, d.y - w.y);
      if (!best || far < best[2]) best = [key, d, far];
    }
    if (!best) return null;
    this.dots.delete(best[0]);
    const d = best[1];
    d.want = w;
    d.boost = w.boost;
    d.delay = 0;
    return d;
  }

  private create(w: Want, env: Env): FxDot {
    if (env.borrow && !env.reduced) {
      const again = this.reclaim(w, env);
      if (again) return again;
    }
    const home =
      env.borrow && !env.reduced
        ? nearestFreeDot(w, env.grid, env.reach, (i, j) => !this.borrowed.has(dotKey(i, j)) && !env.blocked(i, j))
        : null;
    if (home) this.borrowed.add(dotKey(home.i, home.j));
    const x = home ? home.i * env.grid : w.x;
    const y = home ? home.j * env.grid : w.y;
    return { home, x, y, vx: 0, vy: 0, l: 0, vl: 0, size: w.size, vsize: 0, boost: w.boost, want: w, delay: w.delay ?? 0 };
  }

  /** Move every dot one frame on. Returns true while anything is still moving. */
  step(dt: number, env: Env) {
    let moving = false;
    const still = 0.15 * env.px;
    for (const [key, d] of this.dots) {
      const w = d.want;
      if (w && d.delay > 0) {
        d.delay -= dt;
        moving = true;
        continue;
      }
      if (env.reduced) {
        if (w) {
          d.x = w.x;
          d.y = w.y;
        }
        [d.l, d.vl] = springStep(d.l, d.vl, w ? 1 : 0, FADE, dt);
      } else {
        const s = w ? w.spring : HOME;
        const tx = w ? w.x : d.home ? d.home.i * env.grid : d.x;
        const ty = w ? w.y : d.home ? d.home.j * env.grid : d.y;
        [d.x, d.vx] = springStep(d.x, d.vx, tx, s, dt);
        [d.y, d.vy] = springStep(d.y, d.vy, ty, s, dt);
        [d.l, d.vl] = springStep(d.l, d.vl, w ? 1 : 0, s, dt);
      }
      if (w) [d.size, d.vsize] = springStep(d.size, d.vsize, w.size, POP, dt);

      const atRest =
        Math.abs(d.vx) < 2 * env.px &&
        Math.abs(d.vy) < 2 * env.px &&
        Math.abs(d.vl) < 0.02 &&
        Math.abs(d.vsize) < 0.05;
      if (!w) {
        const home = d.home;
        const there = home
          ? Math.abs(d.x - home.i * env.grid) < still && Math.abs(d.y - home.j * env.grid) < still
          : true;
        if (there && d.l < 0.02 && atRest) {
          this.dots.delete(key);
          if (home) this.borrowed.delete(dotKey(home.i, home.j));
          continue;
        }
        moving = true;
      } else if (!atRest || Math.abs(d.x - w.x) > still || Math.abs(d.y - w.y) > still || Math.abs(1 - d.l) > 0.005) {
        moving = true;
      }
    }
    return moving;
  }

  /** Let every dot go home at once, as when the board is swapped out. */
  clear() {
    this.dots.clear();
    this.borrowed.clear();
  }
}
