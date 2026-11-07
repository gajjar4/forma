// Where a wire leaves one thing and arrives at another. Wires are not pinned to
// fixed ports: they always take the side facing the other end, so things can be
// moved anywhere (by hand or by the AI) and the wires stay tidy.

import type { Rect } from "./stacking";

export type Side = "top" | "right" | "bottom" | "left";
export type Anchor = { x: number; y: number; side: Side };

/**
 * What a wire aims at on a thing: its body, plus how far its label reaches
 * below that (a stack's title under its pile). Wires leave the sides of the
 * body, and leave the bottom below the label, never through it.
 */
export type Body = Rect & { below?: number };

/** Gap between a wire's end and the edge of the thing it touches. */
const GAP = 6;

/** The point on a rect's edge facing `toward`, with the side it sits on. */
export function anchorOn(r: Body, toward: { x: number; y: number }): Anchor {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: r.y - GAP, side: "top" };

  // Compare the direction with the rect's own proportions, so a wide card
  // sends wires out of its long sides more often.
  const horizontal = Math.abs(dx) * r.h > Math.abs(dy) * r.w;
  if (horizontal) {
    const side: Side = dx > 0 ? "right" : "left";
    const x = dx > 0 ? r.x + r.w + GAP : r.x - GAP;
    const t = (r.w / 2) / Math.abs(dx);
    return { x, y: clamp(cy + dy * t, r.y + 12, r.y + r.h - 12), side };
  }
  const side: Side = dy > 0 ? "bottom" : "top";
  const y = dy > 0 ? r.y + r.h + (r.below ?? 0) + GAP : r.y - GAP;
  const t = (r.h / 2) / Math.abs(dy);
  return { x: clamp(cx + dx * t, r.x + 12, r.x + r.w - 12), y, side };
}

/** Both ends of a wire between two rects. */
export function wireEnds(a: Body, b: Body): [Anchor, Anchor] {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return [anchorOn(a, cb), anchorOn(b, ca)];
}

const OUT: Record<Side, [number, number]> = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

/**
 * A soft S-curve between two anchors. Each end leaves straight out of its
 * side, then bends, like a patch cable. Returns the SVG path and its midpoint
 * (where a note on the wire sits).
 */
export function wirePath(s: Anchor, t: Anchor) {
  const dist = Math.hypot(t.x - s.x, t.y - s.y);
  const pull = clamp(dist * 0.4, 24, 160);
  const [sx, sy] = OUT[s.side];
  const [tx, ty] = OUT[t.side];
  const c1 = { x: s.x + sx * pull, y: s.y + sy * pull };
  const c2 = { x: t.x + tx * pull, y: t.y + ty * pull };
  const path = `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`;
  // Midpoint of a cubic bezier at t = 0.5.
  const mid = {
    x: 0.125 * s.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * t.x,
    y: 0.125 * s.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * t.y,
  };
  const curve: Cubic = [s, c1, c2, t];
  return { path, mid, curve };
}

type Pt = { x: number; y: number };
export type Cubic = readonly [Pt, Pt, Pt, Pt];

const lerp = (a: Pt, b: Pt, u: number) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

/** Splits a cubic bezier at `u` into the part before and the part after. */
export function splitCubic([p0, p1, p2, p3]: Cubic, u: number): [Cubic, Cubic] {
  const a = lerp(p0, p1, u);
  const b = lerp(p1, p2, u);
  const c = lerp(p2, p3, u);
  const d = lerp(a, b, u);
  const e = lerp(b, c, u);
  const m = lerp(d, e, u);
  return [
    [p0, a, d, m],
    [m, e, c, p3],
  ];
}

export const cubicPath = ([a, b, c, d]: Cubic) => `M ${a.x} ${a.y} C ${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`;

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** How far a wire takes to fade in from a thing and out into the next, in board units. */
export const WIRE_FADE = 40;

/**
 * Where a wire's fade ends and starts again, as fractions of the way from one
 * end to the other. A wire never touches what it connects: it comes out of
 * nothing and goes back into nothing. Short wires fade over at most a third of
 * their length at each end, so they never vanish.
 */
export function wireFade(s: { x: number; y: number }, t: { x: number; y: number }, fade = WIRE_FADE) {
  const length = Math.hypot(t.x - s.x, t.y - s.y);
  const f = length > 0 ? Math.min(1 / 3, fade / length) : 1 / 3;
  return { start: f, end: 1 - f };
}

/** How far a wire takes to fade out before its note and back in after it, in board units. */
export const NOTE_FADE = 22;

/** Half a quiet note's width on the board, from its text: 12px type, small padding. */
export const noteHalfWidth = (text: string) => (Math.min(text.length, 40) * 6.3 + 16) / 2;

/** The narrowest a shortened note gets: a word or two and the ellipsis. */
export const NOTE_MIN_ROOM = 44;

/**
 * How wide a resting note may be on the wire from `s` to `t` (its ends on the
 * two things) before it reaches either of them, or null when it fits whole.
 * A label is level, so it fits when the gap is wider than the words or tall
 * enough for the label to sit in it; otherwise it is cut to the gap's width,
 * keeping `air` clear at each end.
 */
export function noteRoom(
  s: { x: number; y: number },
  t: { x: number; y: number },
  width: number,
  height = 18,
  air = 18,
): number | null {
  const dx = Math.abs(t.x - s.x);
  const dy = Math.abs(t.y - s.y);
  if (dx >= width + 2 * air || dy >= height + 2 * air) return null;
  return Math.max(NOTE_MIN_ROOM, dx - 2 * air);
}

/**
 * The wire cut in two where it passes its note (centred at the curve's
 * midpoint): the part before, which should fade out toward the note, and the
 * part after, which fades back in. The cut is where the curve leaves a box
 * the size of the note plus a little air, so the line fades as it nears the
 * words whichever way it travels. A side with no room is null.
 */
export function aroundNote(curve: Cubic, halfWidth: number, halfHeight = 10) {
  const at = (u: number) => {
    const [p0, p1, p2, p3] = curve;
    const v = 1 - u;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    };
  };
  const m = at(0.5);
  const inside = (u: number) => {
    const p = at(u);
    return Math.abs(p.x - m.x) < halfWidth + 4 && Math.abs(p.y - m.y) < halfHeight + 4;
  };
  let a = 0.5;
  while (a > 0 && inside(a)) a -= 0.004;
  let b = 0.5;
  while (b < 1 && inside(b)) b += 0.004;
  // A side with no room left (the note reaches the card) is simply not drawn:
  // the line never crosses the words, however short the wire.
  const before = a > 0.05 ? splitCubic(curve, a)[0] : null;
  const after = b < 0.95 ? splitCubic(curve, b)[1] : null;
  return { before, after };
}
