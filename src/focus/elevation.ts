// How far a lifted thing has come up from its tile, 0 at the tile and 1 up
// close, read from its scale as it flies. Its corner and its shadow follow
// that one number, so both track the flight exactly, going up and coming
// home, whatever the spring does. Pure, so it can be tested.

/** 0 at the tile's scale, 1 at full size; held inside 0..1 through the spring's overshoot. */
export function liftProgress(scale: number, tileScale: number) {
  if (!(Math.abs(1 - tileScale) > 1e-6)) return 1;
  return Math.min(1, Math.max(0, (scale - tileScale) / (1 - tileScale)));
}

/**
 * The border-radius to set on the lifted box, in its own unscaled px, so the
 * corner you see grows from the tile's (`tileR`) to the lifted one's (`upR`)
 * as it comes up, and back. The box is scaled, so what's set is what should
 * be seen over the scale.
 */
export function cornerAt(scale: number, tileScale: number, tileR: number, upR: number) {
  const seen = tileR + (upR - tileR) * liftProgress(scale, tileScale);
  return seen / Math.max(scale, 1e-3);
}

/**
 * How much of the lifted shadow shows: none at the tile, all of it up close.
 * The shadow already shrinks with the box, so faded in step with the height
 * it looked gone long before the box came down; the square root keeps it
 * nearly full in the air and lets it go over the last of the way.
 */
export const shadowAt = (scale: number, tileScale: number) => Math.sqrt(liftProgress(scale, tileScale));

/** How close to its tile, coming home, the lifted box starts to hand over to the tile itself. */
export const HANDOVER = 0.012;

/**
 * Coming home, how much of the lifted box still shows: all of it until it is
 * nearly down, then it fades into the real tile under it, so the last frames
 * blend from the scaled copy into the tile's own crisp drawing instead of
 * swapping in one frame.
 */
export const handoverAt = (scale: number, tileScale: number) => Math.min(1, liftProgress(scale, tileScale) / HANDOVER);

/**
 * A shadow drawn on a box scaled by `k` that is seen as `shadow` on screen:
 * every length in it over `k` (colours untouched). A white card's resting
 * shadow, set this way on the lifted box, matches its tile's exactly at the
 * tile, so the two can swap without a jump.
 */
export function shadowOver(shadow: string, k: number) {
  const by = Math.max(k, 1e-3);
  // Only lengths: numbers followed by px, never the numbers inside rgba().
  return shadow.replace(/(-?\d*\.?\d+)px/g, (_, n: string) => `${+(Number(n) / by).toFixed(2)}px`);
}
