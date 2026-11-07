// Mounts and unmounts live cards' frames on the board, following the rules in
// policy.ts. One board is on screen at a time, so this is a single shared
// runner: the first live card to show up starts it, the last one to go stops
// it. It never touches the DOM while the board moves; it only notes that it
// moved, and looks again once it rests.

import { useStoreApi } from "@xyflow/react";
import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { detailShows } from "../zoom";
import { decide, type LiveTrack } from "./policy";

type Store = ReturnType<typeof useStoreApi>;

/** The board counts as moving until it has rested this long. */
const REST_MS = 160;

const cards = new Map<string, Element>();
const visible = new Set<string>();
const listeners = new Set<() => void>();
let tracks = new Map<string, LiveTrack>();
let running = new Set<string>();
let store: Store | null = null;
let unsubscribe: (() => void) | null = null;
let observer: IntersectionObserver | null = null;
let detail = true;
let movedAt = -Infinity;
let lastTransform: readonly number[] | null = null;
let holds = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let dueAt = Infinity;

/** Looks again at `at` (performance.now() time), unless a look is due sooner. */
function schedule(at: number) {
  if (timer !== undefined && dueAt <= at) return;
  if (timer !== undefined) clearTimeout(timer);
  dueAt = at;
  timer = setTimeout(tick, Math.max(0, at - performance.now()));
}

function tick() {
  timer = undefined;
  dueAt = Infinity;
  if (!store) return;
  const { transform, width, height, nodeLookup } = store.getState();
  const [tx, ty, z] = transform;
  detail = detailShows(z, detail);
  const now = performance.now();
  const moving = now < movedAt + REST_MS;
  // The middle of the view, in board units.
  const cx = (width / 2 - tx) / z;
  const cy = (height / 2 - ty) / z;
  const candidates = [...cards.keys()].map((id) => {
    const n = nodeLookup.get(id);
    const p = n?.internals.positionAbsolute ?? { x: 0, y: 0 };
    const x = p.x + (n?.measured.width ?? 0) / 2;
    const y = p.y + (n?.measured.height ?? 0) / 2;
    return { id, visible: visible.has(id), distance: Math.hypot(x - cx, y - cy) };
  });
  const next = decide(candidates, { now, detail, moving, held: holds > 0 }, tracks);
  tracks = next.tracks;
  if (moving) schedule(movedAt + REST_MS);
  if (next.nextAt !== null) schedule(next.nextAt);
  const changed = next.running.size !== running.size || [...next.running].some((id) => !running.has(id));
  if (changed) {
    running = next.running;
    listeners.forEach((l) => l());
  }
}

function start(s: Store) {
  stop();
  store = s;
  detail = detailShows(s.getState().transform[2], true);
  lastTransform = s.getState().transform;
  // Panning costs one comparison here; the look waits for the board to rest.
  unsubscribe = s.subscribe((state) => {
    const t = state.transform;
    if (lastTransform && t[0] === lastTransform[0] && t[1] === lastTransform[1] && t[2] === lastTransform[2]) return;
    lastTransform = t;
    movedAt = performance.now();
    schedule(movedAt + REST_MS);
  });
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const id = (e.target as HTMLElement).dataset.liveId;
      if (!id) continue;
      if (e.isIntersecting) visible.add(id);
      else visible.delete(id);
    }
    schedule(performance.now());
  });
  cards.forEach((el) => observer?.observe(el));
}

function stop() {
  unsubscribe?.();
  observer?.disconnect();
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  dueAt = Infinity;
  unsubscribe = null;
  observer = null;
  store = null;
  lastTransform = null;
}

function add(id: string, el: HTMLElement, s: Store) {
  el.dataset.liveId = id;
  cards.set(id, el);
  if (store !== s) start(s);
  else observer?.observe(el);
  schedule(performance.now());
}

function remove(id: string, el: HTMLElement) {
  if (cards.get(id) === el) cards.delete(id);
  observer?.unobserve(el);
  visible.delete(id);
  if (cards.size === 0) {
    stop();
    tracks = new Map();
    running = new Set();
    return;
  }
  schedule(performance.now());
}

/**
 * Something now sits over the board (an opened stack, a live card opened
 * big): the board's live cards wind down until it's gone. Returns the release.
 */
export function holdLive() {
  holds += 1;
  schedule(performance.now());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    holds -= 1;
    schedule(performance.now());
  };
}

/** Whether the live card on node `id` may run its frame now. `ref` is the card's box on the board. */
export function useLiveRun(id: string, ref: RefObject<HTMLElement | null>) {
  const s = useStoreApi();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    add(id, el, s);
    return () => remove(id, el);
  }, [id, ref, s]);
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => running.has(id),
  );
}
