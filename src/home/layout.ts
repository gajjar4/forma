// Where the piles sit on the home screen, and the camera move into one. Pure.

import { GRID } from "../canvas/dots";

/** One pile's place: 10 dots wide, 11 tall, so a fanned pile and its label never reach a neighbour. */
export const CELL_W = GRID * 10;
export const CELL_H = GRID * 11;
/** The pile itself, as on the board (body.ts PILE). */
export const PILE = 200;
/** Room kept clear on the sides, and above and below the grid (the top clears the window buttons). */
const SIDE = GRID * 2;
const TOP = GRID * 3;
const BOTTOM = GRID * 3;

export type Spot = { x: number; y: number };

export type HomeLayout = {
  /** Each pile's centre, in the surface's own coordinates. Every one is on a dot. */
  spots: Spot[];
  cols: number;
  /** How tall the surface is: the window, or the grid when it needs more. */
  height: number;
};

const snapDown = (v: number) => Math.max(0, Math.floor(v / GRID) * GRID);

/**
 * A calm grid: as many columns as fit, rows filled left to right, the whole
 * block centred in the window and snapped to the dots. It sits in the middle
 * of the window while it fits and scrolls from the top when it doesn't.
 */
export function homeLayout(count: number, width: number, height: number): HomeLayout {
  const fit = Math.floor((width - SIDE * 2) / CELL_W);
  const cols = Math.max(1, Math.min(count, fit));
  const rows = Math.ceil(count / cols);
  const gridW = cols * CELL_W;
  const gridH = rows * CELL_H;
  const left = snapDown((width - gridW) / 2);
  const top = Math.max(TOP, snapDown((height - gridH) / 2));
  const spots: Spot[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // The pile's centre is 5 dots in and 4 down, so the label has the rest of the cell.
    spots.push({ x: left + c * CELL_W + CELL_W / 2, y: top + r * CELL_H + GRID * 4 });
  }
  return { spots, cols, height: Math.max(height, top + gridH + BOTTOM) };
}

export type Rect = { left: number; top: number; width: number; height: number };

/** How far the camera moves in: a pile ends up this many times bigger. */
export const DIVE_SCALE = 4;

/**
 * The camera moving into a pile: the transform (origin at the window's top
 * left) that brings the pile's centre to the middle of the window, `scale`
 * times bigger. Played forwards it enters the pile; backwards it comes out.
 */
export function diveTransform(pile: Rect, view: { width: number; height: number }, scale = DIVE_SCALE) {
  const cx = pile.left + pile.width / 2;
  const cy = pile.top + pile.height / 2;
  return { x: view.width / 2 - cx * scale, y: view.height / 2 - cy * scale, scale };
}
