import { useStoreApi } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { dotStyle, GRID } from "./dots";
import { DotRipples } from "./DotRipples";
import { gridFx } from "./gridFx";
import { dotFromKey } from "./gridFx.math";
import { paintSwarm, readInk } from "./gridFx.paint";
import { sceneEnv, sceneWants } from "./gridFx.scene";
import { DotSwarm } from "./gridFx.swarm";

type Transform = readonly [number, number, number];

/** How far the grid layer reaches past the window on every side, in CSS px. More than the largest spacing. */
const MARGIN = 160;

/** Room around the effect dots on their own small canvas, in CSS px. */
const FX_PAD = 12;

/** The effects canvas grows in steps of this many device pixels. */
const FX_STEP = 256;

/**
 * The dot grid. The dots belong to the board: they sit at fixed board
 * positions, so zooming spreads them apart or brings them together (and grows
 * or shrinks them) along with everything else, and no dot ever pops in, pops
 * out or jumps. Zoomed far out the whole grid fades together, see `dotStyle`.
 *
 * One canvas, drawn straight from React Flow's store in the same tick the
 * viewport moves, so it never trails the board. Dots are drawn at their exact
 * positions so they glide smoothly while you zoom.
 *
 * Colour and size come from the `--dot` and `--dot-size` tokens.
 *
 * The grid also lends its dots out (see gridFx.*): hover a thing and a few
 * dots near each side gather into a "+" for its port; pull a wire and dots
 * along it leave the grid to make the wire. While a dot is out its grid spot
 * stays empty, and it flies back into it after. A spring loop runs only while
 * something is moving, then the canvas goes idle again.
 */
export function DotGrid() {
  const store = useStoreApi();
  const gridRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const fxCanvas = fxRef.current;
    const ctx = grid?.getContext("2d");
    const fxCtx = fxCanvas?.getContext("2d");
    if (!grid || !fxCanvas || !ctx || !fxCtx) return;
    const wrap = grid.parentElement as HTMLElement;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let color = "rgba(0, 0, 0, 0.2)";
    let canvasColor = "#f5f5f3";
    let base = 2;
    let drawn: Transform | null = null;
    let ink = readInk(fxCtx, color);
    const swarm = new DotSwarm();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // One dot drawn into a small tile, repeated with a single pattern fill.
    // The tile is about one spacing in device pixels, so dots stay crisp.
    const tile = document.createElement("canvas");
    const tileCtx = tile.getContext("2d");
    let tileKey = "";
    const dotTile = (side: number, radius: number) => {
      const key = `${side}|${radius.toFixed(2)}|${color}`;
      if (key === tileKey || !tileCtx) return;
      tileKey = key;
      tile.width = side;
      tile.height = side;
      tileCtx.clearRect(0, 0, side, side);
      tileCtx.fillStyle = color;
      tileCtx.beginPath();
      tileCtx.arc(side / 2, side / 2, radius, 0, Math.PI * 2);
      tileCtx.fill();
    };

    // The grid layer is painted once per zoom level, a margin larger than the
    // window on every side. Panning never repaints it: the grid repeats every
    // spacing, so moving the canvas by the pan (wrapped to one spacing) is
    // exactly the same picture. That is a compositor move, almost free,
    // instead of re-uploading a full-screen Retina image every frame.
    let painted: { x: number; y: number; spacing: number; size: number; alpha: number } | null = null;

    const paintGrid = (t: Transform) => {
      const [x, y, zoom] = t;
      const { spacing, size, alpha } = dotStyle(zoom, base);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, grid.width, grid.height);
      painted = { x, y, spacing, size, alpha };
      grid.style.transform = "translate3d(0, 0, 0)";
      if (alpha < 0.005) return;
      const side = Math.max(4, Math.min(1024, Math.round(spacing * dpr)));
      const scale = (spacing * dpr) / side;
      dotTile(side, (size * dpr) / 2 / scale);
      const pattern = ctx.createPattern(tile, "repeat");
      if (!pattern) return;
      // Tile centres on the board grid: shift by half a tile, plus the margin.
      const ox = (x + MARGIN - spacing / 2) * dpr;
      const oy = (y + MARGIN - spacing / 2) * dpr;
      pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, ox, oy]));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, grid.width, grid.height);
      ctx.globalAlpha = 1;
    };

    const placeGrid = (t: Transform) => {
      const [x, y, zoom] = t;
      const look = dotStyle(zoom, base);
      const p = painted;
      if (!p || look.spacing !== p.spacing || look.size !== p.size || look.alpha !== p.alpha) return paintGrid(t);
      const sp = p.spacing;
      const wrapTo = (d: number) => {
        let v = ((d % sp) + sp) % sp;
        if (v > sp / 2) v -= sp;
        return Math.round(v * dpr) / dpr;
      };
      grid.style.transform = `translate3d(${wrapTo(x - p.x)}px, ${wrapTo(y - p.y)}px, 0)`;
    };

    // The effects layer: only the dots out on loan, on a small canvas fitted
    // around them (not the whole window). It is painted only while those dots
    // move; panning or sitting still just slides it with the board, like the
    // grid, so hovering a card while you pan costs nothing.
    let fxAt: { zoom: number; bx: number; by: number } | null = null;
    const positionFx = (t: Transform) => {
      if (!fxAt) return;
      const snap = (v: number) => Math.round(v * dpr) / dpr;
      fxCanvas.style.transform = `translate3d(${snap(t[0] + fxAt.bx * t[2])}px, ${snap(t[1] + fxAt.by * t[2])}px, 0)`;
    };
    const paintFx = (t: Transform) => {
      if (swarm.size === 0 && swarm.borrowed.size === 0) {
        if (fxAt) {
          fxAt = null;
          fxCanvas.style.visibility = "hidden";
        }
        return;
      }
      const [, , zoom] = t;
      const { size, alpha } = dotStyle(zoom, base);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const take = (px: number, py: number) => {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      };
      for (const d of swarm.dots.values()) take(d.x, d.y);
      for (const key of swarm.borrowed) {
        const { i, j } = dotFromKey(key);
        take(i * GRID, j * GRID);
      }
      const pad = FX_PAD / zoom;
      const bx = minX - pad;
      const by = minY - pad;
      const w = (maxX - minX) * zoom + FX_PAD * 2;
      const h = (maxY - minY) * zoom + FX_PAD * 2;
      // Resizing a canvas is expensive in WebKit, so the canvas only grows, in
      // generous steps; the dots move around inside it.
      const need = (v: number) => Math.ceil((v * dpr) / FX_STEP) * FX_STEP;
      const cw = Math.max(fxCanvas.width, need(w));
      const ch = Math.max(fxCanvas.height, need(h));
      // The on-screen size must always match the backing store (it starts at
      // the browser's default 300x150), or the dots are drawn at the wrong scale.
      const cssW = `${cw / dpr}px`;
      const cssH = `${ch / dpr}px`;
      if (fxCanvas.width !== cw || fxCanvas.height !== ch || fxCanvas.style.width !== cssW || fxCanvas.style.height !== cssH) {
        fxCanvas.width = cw;
        fxCanvas.height = ch;
        fxCanvas.style.width = cssW;
        fxCanvas.style.height = cssH;
      } else {
        fxCtx.setTransform(1, 0, 0, 1, 0, 0);
        fxCtx.clearRect(0, 0, cw, ch);
      }
      fxAt = { zoom, bx, by };
      fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A dot out on loan leaves its spot empty: cover it with the board colour.
      if (swarm.borrowed.size > 0 && alpha >= 0.005) {
        fxCtx.fillStyle = canvasColor;
        fxCtx.beginPath();
        const r = size / 2 + 0.75;
        for (const key of swarm.borrowed) {
          const { i, j } = dotFromKey(key);
          const cx = (i * GRID - bx) * zoom;
          const cy = (j * GRID - by) * zoom;
          fxCtx.moveTo(cx + r, cy);
          fxCtx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        fxCtx.fill();
      }
      // Board point p lands at (p - b) * zoom on this canvas.
      paintSwarm(fxCtx, swarm, ink, [-bx * zoom, -by * zoom, zoom], size, alpha);
      fxCanvas.style.visibility = "visible";
      positionFx(t);
    };

    /** Moves both layers for a new viewport; repaints only what a zoom actually changes. */
    const draw = (t: Transform) => {
      drawn = t;
      placeGrid(t);
      if (fxAt && fxAt.zoom !== t[2]) paintFx(t);
      else positionFx(t);
    };
    const redraw = () => {
      painted = null;
      const t = drawn ?? store.getState().transform;
      drawn = t;
      placeGrid(t);
      paintFx(t);
    };

    const readTokens = () => {
      const style = getComputedStyle(wrap);
      color = style.getPropertyValue("--dot").trim() || color;
      canvasColor = style.getPropertyValue("--canvas").trim() || canvasColor;
      ink = readInk(fxCtx, color);
      base = parseFloat(style.getPropertyValue("--dot-size")) || base;
      tileKey = "";
    };

    // Size both backing stores to whole device pixels so canvas pixels are screen pixels.
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      grid.width = Math.round((width + MARGIN * 2) * dpr);
      grid.height = Math.round((height + MARGIN * 2) * dpr);
      readTokens();
      redraw();
    };

    const resizer = new ResizeObserver(() => resize());
    resizer.observe(wrap);

    // Moving the window to a display with another pixel ratio.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener("change", onDpr);
    };
    const onDpr = () => {
      resize();
      watchDpr();
    };
    watchDpr();

    // Theme changes swap the tokens.
    const onTheme = () => {
      readTokens();
      redraw();
    };
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", onTheme);
    const themeWatch = new MutationObserver(onTheme);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });

    // The effect loop: springs step once per frame while anything moves.
    let raf = 0;
    let last = 0;
    let wasMoving = false;
    const tick = (now: number) => {
      raf = 0;
      const s = store.getState();
      const dt = last ? Math.min(1 / 30, Math.max(0, (now - last) / 1000)) : 1 / 60;
      last = now;
      const env = sceneEnv(s, GRID, dotStyle(s.transform[2], base).alpha, motion.matches);
      swarm.sync(sceneWants(s, gridFx.get()), env);
      const moving = swarm.step(dt, env);
      drawn = s.transform;
      placeGrid(s.transform);
      // Paint while dots fly, plus the frame they land on; otherwise just slide.
      if (moving || wasMoving || !fxAt || fxAt.zoom !== s.transform[2]) paintFx(s.transform);
      else positionFx(s.transform);
      wasMoving = moving;
      if (moving) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const kick = () => {
      if (raf) return;
      const s = store.getState();
      const fx = gridFx.get();
      if (swarm.size > 0 || fx.hover !== null || fx.drop !== null || s.connection.inProgress) raf = requestAnimationFrame(tick);
    };

    resize();
    // Same store, same tick as React Flow's own viewport write.
    // A pan or zoom only slides the layers: the dots on loan are pinned to the
    // board, so there is nothing to recompute. Anything else that changes in
    // the store (a card dragged, a wire being pulled) wakes the effect.
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.transform !== drawn) draw(s.transform);
      if (s.transform !== prev.transform && !s.connection.inProgress) return;
      kick();
    });
    const unsubscribeFx = gridFx.subscribe(kick);

    return () => {
      unsubscribe();
      unsubscribeFx();
      cancelAnimationFrame(raf);
      resizer.disconnect();
      themeWatch.disconnect();
      scheme.removeEventListener("change", onTheme);
      dprQuery?.removeEventListener("change", onDpr);
    };
  }, [store]);

  return (
    <div className="dots" aria-hidden="true">
      <canvas ref={gridRef} className="dots-grid" />
      <canvas ref={fxRef} className="dots-fx" />
      <DotRipples />
    </div>
  );
}
