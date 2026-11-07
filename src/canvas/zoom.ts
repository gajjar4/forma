import { useStoreApi } from "@xyflow/react";
import { useEffect, useSyncExternalStore } from "react";

type Store = ReturnType<typeof useStoreApi>;

/**
 * Below this zoom the detail (body text, counts, card titles, wire notes)
 * fades out; above the second it comes back. The gap between them keeps it
 * from flickering when you rest right on the line.
 */
export const DETAIL_OFF = 0.53;
export const DETAIL_ON = 0.57;

/** Whether the detail shows at zoom `z`, given whether it showed before. */
export function detailShows(z: number, was: boolean): boolean {
  return was ? z >= DETAIL_OFF : z > DETAIL_ON;
}

/** How long the zoom has to rest before titles and detail catch up with it. */
export const SETTLE_MS = 90;
/** During a long zoom they still catch up this often. */
export const MAX_WAIT_MS = 320;

/**
 * When to write the next zoom: after it has rested for SETTLE_MS, but no
 * later than MAX_WAIT_MS after the first change not yet written.
 */
export function nextWrite(now: number, firstPending: number) {
  return Math.min(now + SETTLE_MS, firstPending + MAX_WAIT_MS);
}

// One board is on screen at a time; this is its semantic zoom.
let store: Store | null = null;
let users = 0;
let stop: (() => void) | null = null;
let shown = 1;
const listeners = new Set<() => void>();

/** The zoom titles are drawn for right now (it trails the live zoom while you zoom). */
export function labelZoom() {
  return shown;
}

function start(s: Store) {
  store = s;
  let dom: HTMLElement | null = null;
  let detail = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstPending = 0;

  const flush = () => {
    timer = undefined;
    const { transform, domNode } = s.getState();
    if (!domNode) return;
    const z = transform[2];
    const fresh = domNode !== dom;
    dom = domNode;
    shown = z;
    domNode.style.setProperty("--z", z.toFixed(3));
    const next = detailShows(z, detail);
    if (next !== detail || fresh) {
      detail = next;
      if (detail) delete domNode.dataset.detail;
      else domNode.dataset.detail = "off";
    }
    listeners.forEach((l) => l());
  };

  const onChange = () => {
    const { transform, domNode } = s.getState();
    if (!domNode) return;
    if (domNode !== dom) return flush();
    // Panning leaves the zoom alone and costs nothing here.
    if (transform[2] === shown && timer === undefined) return;
    const now = performance.now();
    if (timer === undefined) firstPending = now;
    else clearTimeout(timer);
    timer = setTimeout(flush, Math.max(0, nextWrite(now, firstPending) - now));
  };

  flush();
  const unsubscribe = s.subscribe(onChange);
  stop = () => {
    unsubscribe();
    if (timer !== undefined) clearTimeout(timer);
    store = null;
    stop = null;
  };
}

/**
 * Semantic zoom, written straight onto the `.react-flow` element, outside
 * React, so nothing re-renders while you zoom:
 * - `--z`: titles counter-scale from it in CSS so they stay readable when
 *   zoomed out (see "Semantic zoom" in nodes.css).
 * - `data-detail="off"` once zoomed out past about 55%: the detail fades.
 * Both are written when the zoom comes to rest (or every MAX_WAIT_MS during a
 * long zoom), and the CSS glides titles to their new size on the compositor.
 * Writing them on every frame of a zoom made WebKit re-lay-out and repaint
 * the labels on every frame, which a busy machine couldn't keep up with.
 *
 * Every node calls this; the first one subscribes, the last one to go away
 * unsubscribes.
 */
export function useZoomVar() {
  const s = useStoreApi();
  useEffect(() => {
    if (store !== s) {
      stop?.();
      start(s);
    }
    users += 1;
    return () => {
      users -= 1;
      if (users === 0) stop?.();
    };
  }, [s]);
}

/** The zoom titles are drawn for, as React state: re-renders when it's written. */
export function useLabelZoom() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    labelZoom,
  );
}
