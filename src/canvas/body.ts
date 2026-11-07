// What wires and ports aim at on each thing, at the current zoom.
//
// With semantic zoom a title can grow past the box React Flow measured (a
// stack's title under its pile, a card's title under its picture). Wires and
// the dot "+"s use this instead of the measured box: the sides aim at the
// thing itself (the pile, not the pile and its label), and the bottom sits
// below the title's current visual extent, never on it.
//
// The numbers mirror nodes.css ("Stack: a pile" and "Card"). Change both.

import type { InternalNode } from "@xyflow/react";
import { clamp } from "../model/geometry";
import type { Body, Side } from "../model/geometry";
import { docPicture } from "../model/docs";
import { isMedia } from "../model/items";
import type { CardData, StackData } from "../model/types";
import { DETAIL_OFF, DETAIL_ON } from "./zoom";

/** A stack's pile is a square: the cover's box plus room for the fan. */
export const PILE = 200;
/**
 * How far past the pile's sides its left and right ports sit, so their "+"
 * stays clear of the fanned cards (hover, or something held over the stack).
 * The widest fanned card is 176 square, pushed 34 out and turned 12 degrees:
 * 34 + 88 cos 12 + 88 sin 12 = 138 from the centre, 38 past the pile's side.
 * Plus a little air. nodes.css places the handles to match.
 */
export const FAN_ASIDE = 44;
/** Gap between the pile and its label. */
const LABEL_GAP = 12;
/** One line of the title (and of the description). */
const LINE = 17;
/** How wide the label may look, in board units, before the title wraps. */
const LABEL_MAX = 280;

/** How much a stack's label is scaled up at zoom `z`, so it stays readable. */
export function stackLabelScale(z: number) {
  return clamp(0.96 / z, 1, 3.4);
}

/** How much a card's title is scaled up at zoom `z`. */
export function cardTitleScale(z: number) {
  return clamp(1 / z, 1, 1.8);
}

/** Whether the detail (counts, descriptions, card titles) shows at zoom `z`. */
const detailAt = (z: number) => z >= (DETAIL_OFF + DETAIL_ON) / 2;

let ctx: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/**
 * A stack title's width on one line, unscaled, in board units. Measured with
 * the title's own font, once per title; without a canvas (tests) it's a close
 * guess from the length.
 */
export function titleWidth(text: string): number {
  const known = widths.get(text);
  if (known !== undefined) return known;
  if (ctx === undefined) {
    ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (ctx) ctx.font = '500 13px "Geist Variable", -apple-system, system-ui, sans-serif';
  }
  const w = ctx ? ctx.measureText(text).width : text.length * 6.9;
  widths.set(text, w);
  return w;
}

/** How many lines a stack title takes at zoom `z` (it wraps to two at most). */
export function titleLines(width: number, z: number) {
  return width > LABEL_MAX / stackLabelScale(z) ? 2 : 1;
}

/** How far below its pile a stack's label reaches at zoom `z`, as it looks. */
export function stackLabelBelow(data: Pick<StackData, "title" | "description">, z: number) {
  const lines = titleLines(titleWidth(data.title), z) + (data.description && detailAt(z) ? 1 : 0);
  return LABEL_GAP + stackLabelScale(z) * lines * LINE;
}

/** The stack's label height in the layout (what React Flow measures under the pile). */
export function stackLabelRow(data: Pick<StackData, "description">) {
  return LABEL_GAP + (data.description ? 2 : 1) * LINE;
}

/** The part of a thing wires and ports aim at, at zoom `z`, in board units. */
export function bodyOf(n: InternalNode, z: number): Body {
  const { x, y } = n.internals.positionAbsolute;
  const w = n.measured.width ?? 0;
  const h = n.measured.height ?? 0;
  if (n.type === "stack") {
    return { x, y, w, h: PILE, below: stackLabelBelow(n.data as StackData, z) };
  }
  // An image, a PDF's page or a live card has its title under it; a link or another document carries its own inside.
  const item = n.type === "card" ? (n.data as CardData).item : undefined;
  if (item?.title?.trim() && item.kind === "live") {
    // Named like a stack: it stays and grows as you zoom out, from its line (17 tall).
    return { x, y, w, h, below: (stackLabelScale(z) - 1) * LINE };
  }
  if (item && ((item.title && isMedia(item)) || docPicture(item)) && detailAt(z)) {
    // The title grows downward from its line (about 16 tall) under the picture.
    return { x, y, w, h, below: (cardTitleScale(z) - 1) * 16 };
  }
  return { x, y, w, h };
}

/**
 * Where a port's "+" sits, `out` past its handle: the top on the body's top
 * edge, the bottom under the label, and a stack's sides out past its fan.
 * nodes.css puts the invisible handles on the same spots, so a wire pulled
 * from a port starts at its "+".
 */
export function portCentreOf(n: InternalNode, side: Side, z: number, out: number) {
  const b = bodyOf(n, z);
  const aside = n.type === "stack" ? FAN_ASIDE : 0;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (side === "top") return { x: cx, y: b.y - out };
  if (side === "bottom") return { x: cx, y: b.y + b.h + (b.below ?? 0) + out };
  if (side === "left") return { x: b.x - aside - out, y: cy };
  return { x: b.x + b.w + aside + out, y: cy };
}
