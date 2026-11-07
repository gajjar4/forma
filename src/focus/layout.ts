// Pure layout maths for an opened stack: how big a cell is, where the grid
// sits around the stack it came out of, which slot a point falls in while
// dragging, and how long each image waits before it flies.

import { itemShape } from "../model/items";
import type { Item } from "../model/types";

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };
/** Where a tile is drawn: top-left in sheet coordinates, then scale and tilt about its centre. */
export type Pose = { x: number; y: number; scale: number; rotate: number; opacity: number };
export type Margins = { top: number; right: number; bottom: number; left: number };

export type GridPlan = {
  count: number;
  cols: number;
  rows: number;
  /** Side of one square cell; every image is centred and contained in one. */
  cell: number;
  gap: number;
  /** Cell plus gap: the distance from one cell to the next. */
  pitch: number;
  /** Top-left of the first cell, in sheet coordinates. */
  origin: Point;
  /** The scrollable sheet everything sits on: the grid plus room to move around it. */
  sheet: Size;
  /** Where to scroll the sheet to on open, so the grid sits around the anchor. */
  scroll: Point;
};

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Cell and gap for a viewport width. Airy: gaps are about a quarter of a cell. */
export function cellMetrics(viewportW: number) {
  return {
    cell: clamp(Math.round(viewportW * 0.15), 168, 264),
    gap: clamp(Math.round(viewportW * 0.042), 48, 68),
  };
}

/**
 * Columns for `count` images: the grid takes the shape of the free space, so a
 * small stack is a tidy block and a big one becomes a field that runs past the
 * window both ways.
 */
export function chooseColumns(count: number, inner: Size) {
  if (count <= 1) return 1;
  const ideal = Math.round(Math.sqrt((count * inner.w) / Math.max(1, inner.h)));
  return clamp(ideal, 1, count);
}

/** Extra room around the grid, as a share of the window, so the field can always be moved around. */
export const ROAM = 0.5;

/**
 * One axis of the placement. A grid that fits is centred on the anchor (where
 * the stack was on screen), then pushed back inside the margins. A grid longer
 * than the window opens at the same relative spot as the anchor: a stack near
 * the top opens on the top of its grid, one near the bottom on the bottom.
 *
 * Either way the sheet has `roam` of free room on both sides, and opens
 * scrolled past it, so what you see first is the same but you can always drag
 * or scroll the field in any direction, even when the grid is small.
 */
export function placeAxis(span: number, viewport: number, before: number, after: number, anchor: number, roam = 0) {
  const room = Math.round(roam);
  const inner = viewport - before - after;
  if (span <= inner) {
    const start = clamp(anchor - span / 2, before, before + inner - span);
    return { sheet: viewport + room * 2, origin: Math.round(start) + room, scroll: room };
  }
  const f = clamp((anchor - before) / inner, 0, 1);
  return { sheet: span + before + after + room * 2, origin: before + room, scroll: Math.round(f * (span - inner)) + room };
}

export function planGrid(count: number, viewport: Size, anchor: Point, margins: Margins): GridPlan {
  const { cell, gap } = cellMetrics(viewport.w);
  const pitch = cell + gap;
  const inner = {
    w: Math.max(pitch, viewport.w - margins.left - margins.right),
    h: Math.max(pitch, viewport.h - margins.top - margins.bottom),
  };
  const n = Math.max(1, count);
  const cols = chooseColumns(n, inner);
  const rows = Math.ceil(n / cols);
  const x = placeAxis(cols * pitch - gap, viewport.w, margins.left, margins.right, anchor.x, viewport.w * ROAM);
  const y = placeAxis(rows * pitch - gap, viewport.h, margins.top, margins.bottom, anchor.y, viewport.h * ROAM);
  return {
    count,
    cols,
    rows,
    cell,
    gap,
    pitch,
    origin: { x: x.origin, y: y.origin },
    sheet: { w: x.sheet, h: y.sheet },
    scroll: { x: x.scroll, y: y.scroll },
  };
}

/** An image's size inside a square box, keeping its proportions. */
export function fitSize(w: number | undefined, h: number | undefined, box: number): Size {
  const iw = w && w > 0 ? w : 1;
  const ih = h && h > 0 ? h : 1;
  const s = box / Math.max(iw, ih);
  return { w: Math.round(iw * s), h: Math.round(ih * s) };
}

/** An item's size inside a square cell: images keep their proportions, notes and links their shape. */
export function sizeIn(item: Item, cell: number): Size {
  const { w, h } = itemShape(item);
  return fitSize(w, h, cell);
}

/** Top-left of an image of `size` centred in slot `index`, in sheet coordinates. */
export function slotPosition(plan: GridPlan, index: number, size: Size): Point {
  const col = index % plan.cols;
  const row = Math.floor(index / plan.cols);
  return {
    x: plan.origin.x + col * plan.pitch + (plan.cell - size.w) / 2,
    y: plan.origin.y + row * plan.pitch + (plan.cell - size.h) / 2,
  };
}

/**
 * The slot under a point while dragging. Each cell owns half the gap on every
 * side, so there is no dead zone, and points off the grid snap to its edge.
 */
export function slotAt(plan: GridPlan, p: Point) {
  const col = clamp(Math.floor((p.x - plan.origin.x + plan.gap / 2) / plan.pitch), 0, plan.cols - 1);
  const row = clamp(Math.floor((p.y - plan.origin.y + plan.gap / 2) / plan.pitch), 0, plan.rows - 1);
  return clamp(row * plan.cols + col, 0, Math.max(0, plan.count - 1));
}

/** The list with one entry moved from `from` to `to`; the rest close up. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from === to || from < 0 || from >= list.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(clamp(to, 0, next.length), 0, moved);
  return next;
}

/**
 * Delay for the i-th of `count` in a staggered sequence. Steps are `step`
 * apart until the whole spread would pass `max`; then they squeeze to fit, so
 * a stack of 60 takes no longer to deal out than a stack of 12.
 */
export function stagger(i: number, count: number, step: number, max: number) {
  if (count <= 1 || i <= 0) return 0;
  return i * Math.min(step, max / (count - 1));
}
