// How the cards of a pile sit, at rest and fanned: a stack on the board and a
// board on the home screen are the same pile.

import type { CSSProperties } from "react";

/** How the cards under the cover sit, from the one just below the top down. */
const REST = [
  { rotate: -5, x: -8, y: 4 },
  { rotate: 6, x: 9, y: 6 },
  { rotate: -2, x: 2, y: 10 },
];
/** Hover fans them out so you can see there's more inside. */
const FAN = [
  { rotate: -12, x: -34, y: 6 },
  { rotate: 12, x: 34, y: 8 },
  { rotate: -4, x: 0, y: 18 },
];

/**
 * Each card's rest and fan pose as CSS custom properties. The transform is
 * composed in nodes.css and the fan is a plain CSS transition on prepared
 * layers: no animation JS, so the first hover is as smooth as the tenth.
 */
export function pose(i: number): CSSProperties {
  if (i === 0) return { "--rs": 1, "--fs": 1.02, "--ts": 1.04 } as CSSProperties;
  const r = REST[i - 1];
  const f = FAN[i - 1];
  return {
    "--rx": `${r.x}px`,
    "--ry": `${r.y}px`,
    "--rr": `${r.rotate}deg`,
    "--fx": `${f.x}px`,
    "--fy": `${f.y}px`,
    "--fr": `${f.rotate}deg`,
  } as CSSProperties;
}
