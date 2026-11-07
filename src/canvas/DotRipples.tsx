import { useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { dotStyle, GRID } from "./dots";
import { readInk } from "./gridFx.paint";
import { reachOf, ripples, rippleDots, RIPPLE_MS } from "./gridFx.ripple";

/** The canvas grows in steps of this many device pixels, never shrinks: resizing is slow in WebKit. */
const STEP = 256;
/** A dot at the ring's front: as dark and a touch larger than a port's "+" dot. */
const PEAK = 2.8;
const GROW = 0.45;

/**
 * The grid's ripples (gridFx.ripple.ts), drawn over the grid in its own
 * colour, darker. Its canvas covers only the part of the ripples on screen,
 * is painted only while one runs, and is hidden the rest of the time. Dots
 * sit on board positions, so a ripple zooms and pans with the board.
 */
export function DotRipples() {
  const store = useStoreApi();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const wrap = canvas?.parentElement;
    if (!canvas || !ctx || !wrap) return;
    let raf = 0;
    let ink = readInk(ctx, "rgba(20, 20, 18, 0.2)");
    let base = 2;

    const hide = () => {
      canvas.style.visibility = "hidden";
    };

    const paint = (now: number) => {
      raf = 0;
      const live = ripples.live(now);
      const reach = reachOf(live);
      if (!reach) return hide();
      const [tx, ty, zoom] = store.getState().transform;
      const { size, alpha } = dotStyle(zoom, base);
      const box = wrap.getBoundingClientRect();
      // The ripples' reach on screen, cut to the window.
      const x0 = Math.max(0, Math.floor(tx + reach.x * zoom));
      const y0 = Math.max(0, Math.floor(ty + reach.y * zoom));
      const x1 = Math.min(box.width, Math.ceil(tx + (reach.x + reach.w) * zoom));
      const y1 = Math.min(box.height, Math.ceil(ty + (reach.y + reach.h) * zoom));
      if (x1 <= x0 || y1 <= y0 || alpha < 0.005) {
        hide();
        raf = requestAnimationFrame(paint);
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const need = (v: number) => Math.ceil((v * dpr) / STEP) * STEP;
      const cw = Math.max(canvas.width, need(x1 - x0));
      const ch = Math.max(canvas.height, need(y1 - y0));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${cw / dpr}px`;
        canvas.style.height = `${ch / dpr}px`;
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgb(${ink.r}, ${ink.g}, ${ink.b})`;
      const dots = new Map<string, { i: number; j: number; s: number }>();
      for (const r of live) rippleDots(r.rect, (now - r.start) / RIPPLE_MS, GRID, dots);
      const peak = Math.min(1, ink.a * PEAK) * alpha;
      for (const { i, j, s } of dots.values()) {
        const cx = tx + i * GRID * zoom - x0;
        const cy = ty + j * GRID * zoom - y0;
        if (cx < -4 || cy < -4 || cx > x1 - x0 + 4 || cy > y1 - y0 + 4) continue;
        ctx.globalAlpha = peak * s;
        ctx.beginPath();
        ctx.arc(cx, cy, (size * (1 + GROW * s)) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      canvas.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;
      canvas.style.visibility = "visible";
      raf = requestAnimationFrame(paint);
    };

    const start = () => {
      const style = getComputedStyle(wrap);
      ink = readInk(ctx, style.getPropertyValue("--dot").trim() || "rgba(20, 20, 18, 0.2)");
      base = parseFloat(style.getPropertyValue("--dot-size")) || base;
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const stop = ripples.subscribe(start);
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, [store]);

  return <canvas ref={ref} className="dots-fx" />;
}
