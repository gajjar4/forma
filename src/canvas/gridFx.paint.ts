// Drawing the dots that have left the grid. A dot at home looks exactly like
// a grid dot (same colour, size and strength), so handing it back to the grid
// is invisible; gathered, it is a touch larger and stronger.

import type { DotSwarm } from "./gridFx.swarm";

export type Ink = { r: number; g: number; b: number; a: number };

/** A CSS colour as rgba numbers, using the canvas to normalise whatever form the token takes. */
export function readInk(ctx: CanvasRenderingContext2D, css: string): Ink {
  const before = ctx.fillStyle;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  const v = String(ctx.fillStyle);
  ctx.fillStyle = before;
  const hex = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  const n = v.match(/[\d.]+/g)?.map(Number) ?? [];
  return { r: n[0] ?? 0, g: n[1] ?? 0, b: n[2] ?? 0, a: n[3] ?? 1 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Draw every swarm dot. `x`, `y`, `zoom` is the viewport; `gridSize` and
 * `gridAlpha` are the grid's own look at this zoom. Expects the canvas
 * transform already scaled to CSS pixels.
 */
export function paintSwarm(
  ctx: CanvasRenderingContext2D,
  swarm: DotSwarm,
  ink: Ink,
  [x, y, zoom]: readonly [number, number, number],
  gridSize: number,
  gridAlpha: number,
) {
  if (!swarm.size) return;
  ctx.fillStyle = `rgb(${ink.r}, ${ink.g}, ${ink.b})`;
  const homeAlpha = ink.a * gridAlpha;
  for (const d of swarm.dots.values()) {
    const l = clamp01(d.l);
    // Size may overshoot a little with the spring: that is the pop.
    const grow = Math.min(1.2, Math.max(0, d.l));
    const fx = Math.min(1, ink.a * d.boost);
    const alpha = d.home ? homeAlpha + (fx - homeAlpha) * l : fx * l;
    if (alpha < 0.004) continue;
    const size = d.home ? gridSize + (d.size - gridSize) * grow : d.size * (0.6 + 0.4 * grow);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x + d.x * zoom, y + d.y * zoom, Math.max(0.25, size / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
