// Where things sit when an image is lifted: the picture in the middle, its
// note under it, the palette down its left side and where it came from down
// its right. Pure, so it can be tested.

import type { Rect } from "./Lift";
import type { Size } from "./layout";

/** Height kept free under the image for its note. */
export const NOTE_ROOM = 156;
/** Width kept free at each side of the image for the palette and the source. */
export const SIDE_ROOM = 220;
/** Space between the image and what sits around it. */
export const GAP = 28;
/** The least space kept between anything and the window's edge. */
export const EDGE = 40;
const NOTE_MIN = 360;
const NOTE_MAX = 560;

export type DetailLayout = {
  /** The image at rest, in window coordinates. */
  image: Rect;
  /** How far the image's centre sits above the window's, to leave room for the note. */
  dy: number;
  /** The note field: its left, top and width; it grows down from there, at most `maxH` tall. */
  note: { x: number; y: number; w: number; maxH: number };
  /** The palette's column: its right edge and top. */
  swatches: { right: number; y: number };
  /** The source and date: their left edge, top and widest. */
  info: { x: number; y: number; w: number };
};

/** The lifted image as big as it can be with its note and both sides still in view. */
export function detailLayout(view: Size, aspect: number): DetailLayout {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const most = { w: Math.min(view.w * 0.78, view.w - 2 * SIDE_ROOM), h: Math.min(view.h * 0.72, view.h - 2 * EDGE - NOTE_ROOM) };
  const w = Math.max(1, Math.min(most.w, most.h * a));
  const h = w / a;
  const dy = -NOTE_ROOM / 2;
  const image = { x: (view.w - w) / 2, y: (view.h - h) / 2 + dy, w, h };
  const noteW = Math.min(Math.max(w, NOTE_MIN), NOTE_MAX, view.w - 2 * EDGE);
  const noteY = image.y + h + GAP;
  const infoX = image.x + w + GAP;
  return {
    image,
    dy,
    note: { x: image.x + w / 2 - noteW / 2, y: noteY, w: noteW, maxH: Math.max(48, view.h - noteY - EDGE) },
    swatches: { right: view.w - (image.x - GAP), y: image.y },
    info: { x: infoX, y: image.y, w: Math.max(80, view.w - infoX - EDGE) },
  };
}
