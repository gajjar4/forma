// The opening of a stack: where every image starts on the pile, where it
// rests in the grid, and the flight between the two.

import { animate, type Transition } from "motion/react";
import { pictureOf } from "../model/items";
import type { Item } from "../model/types";
import { planGrid, sizeIn, slotPosition, type GridPlan, type Pose } from "./layout";
import { MARGINS } from "./motion";
import { poseOnPile, readPile, type Pile } from "./pile";
import type { TileValues } from "./Tile";

export type Stack = { id: string; title: string; items: Item[] };

/** Grid order: the cover first, then down through the pile. */
export const gridOrder = (items: Item[]) => items.map((i) => i.id).reverse();

export function restPose(plan: GridPlan, index: number, item: Item): Pose {
  const size = sizeIn(item, plan.cell);
  return { ...slotPosition(plan, index, size), scale: 1, rotate: 0, opacity: 1 };
}

export function flyTo(v: TileValues, to: Pose, move: Transition, fade: Transition) {
  return Promise.all([
    animate(v.x, to.x, move),
    animate(v.y, to.y, move),
    animate(v.scale, to.scale, move),
    animate(v.rotate, to.rotate, move),
    animate(v.opacity, to.opacity, fade),
  ]);
}

/** Everything the first frame needs, read once off the board. */
export function firstFrame(stack: Stack, reduced: boolean) {
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const pile: Pile | null = readPile(stack.id);
  const anchor = pile?.centre ?? { x: viewport.w / 2, y: viewport.h / 2 };
  const order = gridOrder(stack.items);
  const plan = planGrid(order.length, viewport, anchor, MARGINS);
  const starts = new Map<string, Pose>();
  stack.items.forEach((item) => {
    const i = order.indexOf(item.id);
    const onPile = !reduced && pile && poseOnPile(i, sizeIn(item, plan.cell), pile, plan.scroll);
    starts.set(item.id, onPile || { ...restPose(plan, i, item), opacity: 0 });
  });
  return { viewport, anchor, scroll: plan.scroll, starts };
}

/**
 * Starts loading and decoding every image of the stack off the main thread
 * the moment it opens. The images deeper than the pile's four have never been
 * drawn on the board, so without this they would decode on the frame they
 * first fade in, partway through the deal-out. Hold on to what this returns
 * while the stack is open, so the decoded pictures are kept.
 */
export function warmImages(items: Item[]) {
  return items.flatMap((item) => {
    const still = pictureOf(item);
    if (!still) return [];
    const img = new Image();
    img.src = still;
    img.decode().catch(() => {});
    return [img];
  });
}
