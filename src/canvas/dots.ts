/** Space between dots on the board, in board units. Dots sit on this grid and nowhere else. */
export const GRID = 32;

/** Below this on-screen spacing the dots are gone; above FULL they are at full strength. */
export const FADE_OUT = 9;
export const FULL = 18;

const smoothstep = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * How the dots look at a zoom level. The dots belong to the board: they always
 * sit at the same board positions, spread apart and grow as you zoom in, and
 * come together and shrink as you zoom out. No dot ever appears or disappears
 * on its own; zoomed far out, where they would crowd into noise, the whole
 * grid fades together instead.
 *
 * `base` is the dot's diameter at 100% zoom. Size follows the square root of
 * the zoom, so dots grow with the board without turning into blobs up close.
 */
export function dotStyle(zoom: number, base = 2, grid = GRID) {
  const z = zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
  const spacing = grid * z;
  const size = Math.min(base * 2.5, Math.max(base * 0.5, base * Math.sqrt(z)));
  const alpha = smoothstep((spacing - FADE_OUT) / (FULL - FADE_OUT));
  return { spacing, size, alpha };
}

/**
 * The dots along one screen axis. `origin` is where board 0 lands on screen.
 * Returns the index of the first dot at or after `-pad` and how many dots
 * cover up to `length + pad`. Indices are board positions, so a dot keeps its
 * index while you pan and zoom.
 */
export function axisDots(origin: number, spacing: number, length: number, pad = 0) {
  const first = Math.ceil((-pad - origin) / spacing) + 0; // + 0 turns -0 into 0
  const last = Math.floor((length + pad - origin) / spacing);
  return { first, count: Math.max(0, last - first + 1) };
}

/**
 * The nearest dot to a board position. Things placed on the board snap their
 * top-left corner to a dot, like FigJam, so everything lines up with the grid
 * and with everything else.
 */
export function snapToDots(p: { x: number; y: number }, grid = GRID) {
  return { x: Math.round(p.x / grid) * grid + 0, y: Math.round(p.y / grid) * grid + 0 };
}
