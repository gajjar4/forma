// Reading a stack's pile off the board, so the opened images can start from
// exactly where its cards are and land back on them when it closes.

import type { Point, Pose, Size } from "./layout";

/** One card as it looks on screen: centre, drawn size and tilt. */
export type CardPose = { cx: number; cy: number; w: number; h: number; rotate: number };

export type Pile = {
  /** Cards from the bottom of the pile up; the last one is the cover. */
  cards: CardPose[];
  centre: Point;
};

/** Rotation (degrees) and uniform scale out of a computed CSS transform. */
export function poseFromTransform(transform: string) {
  const m = /^matrix(3d)?\(([^)]+)\)$/.exec(transform.trim());
  if (!m) return { rotate: 0, scale: 1 };
  const v = m[2].split(",").map(Number);
  const [a, b] = v;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { rotate: 0, scale: 1 };
  return { rotate: (Math.atan2(b, a) * 180) / Math.PI, scale: Math.hypot(a, b) || 1 };
}

function stackNode(stackId: string) {
  const id = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(stackId) : stackId;
  return document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
}

/** The pile of this stack as it is on screen now, or null if it isn't there. */
export function readPile(stackId: string): Pile | null {
  const pile = stackNode(stackId)?.querySelector<HTMLElement>(".stack-pile");
  if (!pile || !pile.offsetWidth) return null;
  const box = pile.getBoundingClientRect();
  const zoom = box.width / pile.offsetWidth;
  const cards = Array.from(pile.querySelectorAll<HTMLElement>(".stack-card")).map((el) => {
    const r = el.getBoundingClientRect();
    const { rotate, scale } = poseFromTransform(getComputedStyle(el).transform);
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      w: el.offsetWidth * zoom * scale,
      h: el.offsetHeight * zoom * scale,
      rotate,
    };
  });
  return { cards, centre: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
}

/** Hide the pile on the board while its images are out (see focus.css). */
export function setPileOut(stackId: string, out: boolean) {
  stackNode(stackId)?.toggleAttribute("data-focus-out", out);
}

/**
 * Where the image `index` places down from the cover (0 is the cover) sits on
 * the pile, for a tile drawn at `size` on a sheet scrolled by `scroll`. The
 * pile shows four cards; images deeper than that sit hidden under its centre.
 */
export function poseOnPile(index: number, size: Size, pile: Pile, scroll: Point): Pose | null {
  const m = pile.cards.length;
  if (!m) return null;
  const card = index < m ? pile.cards[m - 1 - index] : null;
  if (card) {
    return {
      x: card.cx + scroll.x - size.w / 2,
      y: card.cy + scroll.y - size.h / 2,
      scale: card.w / size.w,
      rotate: card.rotate,
      opacity: 1,
    };
  }
  const base = pile.cards[0];
  return {
    x: pile.centre.x + scroll.x - size.w / 2,
    y: pile.centre.y + scroll.y - size.h / 2,
    scale: Math.max(base.w, base.h) / Math.max(size.w, size.h),
    rotate: 0,
    opacity: 0,
  };
}
