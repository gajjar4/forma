// How things that changed outside the app show it: the DOM side of
// useChanges.ts (the grid's ripple is gridFx.ripple.ts). It only sets an
// attribute, or starts an opacity and scale animation, on elements React
// Flow has already drawn, so nothing re-renders for it. The "new" dots on the
// board live in a layer of their own above it; styles/changes.css draws them.

/** How long the "since you last looked" dot takes to fade once seen. changes.css matches it. */
const SEEN_OUT_MS = 1200;
/** How long a new wire takes to draw itself in. */
const DRAW_MS = 900;
/** Something new is drawn a frame or two after it arrives; this is how long to look for it. */
const FRAMES = 40;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";

export const nodeEl = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
export const edgeEl = (root: HTMLElement, id: string) =>
  root.querySelector<SVGGElement>(`.react-flow__edge[data-id="${CSS.escape(id)}"]`);
export const labelEl = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.wire-label[data-wire="${CSS.escape(id)}"]`);
/** An item's tile in the opened stack. */
export const tileEl = (id: string) => document.querySelector<HTMLElement>(`.focus .ft[data-id="${CSS.escape(id)}"]`);

/** Calls `then` with the element once it is drawn, looking for it each frame for a little while. */
export function whenDrawn<E extends Element>(find: () => E | null, then: (el: E) => void, tries = FRAMES) {
  const el = find();
  if (el) then(el);
  else if (tries > 0) requestAnimationFrame(() => whenDrawn(find, then, tries - 1));
}

const timers = new WeakMap<Element, number>();

function later(el: Element, ms: number, fn: () => void) {
  window.clearTimeout(timers.get(el));
  timers.set(el, window.setTimeout(fn, ms));
}

/**
 * Something new settles into place: in from a touch smaller and faint. On
 * its inner element, so React Flow's own position transform is left alone.
 */
export function settle(wrapper: HTMLElement) {
  const el = wrapper.firstElementChild;
  if (!el) return;
  if (reduced()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  else el.animate([{ opacity: 0, scale: "0.985" }, { opacity: 1, scale: "1" }], { duration: 420, easing: easeOut });
}

/** What the dot is pinned to the corner of: a stack's cover card, a wire's note, or the thing itself. */
const cornerOf = (el: HTMLElement) =>
  el.querySelector<HTMLElement>(".stack-card:last-child") ??
  el.querySelector<HTMLElement>(".wire-note") ??
  el.querySelector<HTMLElement>(".card-media") ??
  el;

/** How far out from the corner the dot sits, in screen pixels. */
const OUT = 5;

/**
 * The board's dots are drawn in their own layer over the board, at screen
 * size, and follow what they are pinned to. Inside the board they would be
 * drawn into its layer, which WebKit paints once and then scales as you zoom:
 * a dot that small turns into a blurred square.
 */
let layer: HTMLElement | null = null;
const dots = new Map<HTMLElement, HTMLElement>();
let placing = 0;

/** Starts the dots' layer inside the board's element; returns what takes it away. */
export function seenLayer(root: HTMLElement) {
  const el = document.createElement("div");
  el.className = "seen-dots";
  el.setAttribute("aria-hidden", "true");
  root.appendChild(el);
  layer = el;
  return () => {
    cancelAnimationFrame(placing);
    placing = 0;
    el.remove();
    if (layer === el) layer = null;
    dots.clear();
  };
}

/** Moves every dot to its thing's corner on the next frame, once the board has moved there. */
export function placeSeen() {
  if (!layer || !dots.size || placing) return;
  placing = requestAnimationFrame(() => {
    placing = 0;
    if (!layer) return;
    const o = layer.getBoundingClientRect();
    for (const [el, dot] of dots) {
      if (!el.isConnected) {
        dot.remove();
        dots.delete(el);
        continue;
      }
      const r = cornerOf(el).getBoundingClientRect();
      dot.style.transform = `translate(${r.right - o.left + OUT}px, ${r.top - o.top - OUT}px)`;
    }
  });
}

/**
 * Where a thing is, in board units, from where it is drawn: a stack by its
 * pile, so a ripple starts at the cards and not around the name.
 */
export function boardRectOf(el: HTMLElement, root: HTMLElement, [tx, ty, z]: readonly [number, number, number]) {
  const r = (el.querySelector<HTMLElement>(".stack-pile") ?? el).getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { x: (r.left - o.left - tx) / z, y: (r.top - o.top - ty) / z, w: r.width / z, h: r.height / z };
}

/**
 * A small blue dot just off its top-right corner, until it has been seen.
 * On the board it goes in the dots' layer; a tile in an opened stack is
 * drawn at full size, so it carries its own (changes.css).
 */
export function pinSeen(el: HTMLElement) {
  window.clearTimeout(timers.get(el));
  el.dataset.unseen = "pinned";
  if (el.classList.contains("ft") || !layer) return;
  let dot = dots.get(el);
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "seen-dot";
    layer.appendChild(dot);
    dots.set(el, dot);
  }
  dot.dataset.state = "pinned";
  placeSeen();
}

/** Seen: the dot fades away. */
export function unpinSeen(el: HTMLElement) {
  if (el.dataset.unseen !== "pinned") return;
  el.dataset.unseen = "fading";
  const dot = dots.get(el);
  if (dot) dot.dataset.state = "fading";
  later(el, SEEN_OUT_MS + 100, () => {
    if (el.dataset.unseen !== "fading") return;
    delete el.dataset.unseen;
    dots.get(el)?.remove();
    dots.delete(el);
  });
}

/** A new wire draws itself along its path, out of one thing into the other. */
export function drawWire(edge: SVGGElement, delay = 0) {
  for (const path of edge.querySelectorAll<SVGPathElement>("path.wire")) {
    if (reduced()) {
      path.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay, fill: "backwards" });
      continue;
    }
    const len = Math.ceil(path.getTotalLength()) + 1;
    const dash = `${len} ${len}`;
    path.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: len },
        { strokeDasharray: dash, strokeDashoffset: 0 },
      ],
      { duration: DRAW_MS, delay, easing: easeOut, fill: "backwards" },
    );
  }
}

/**
 * Something taken off the board fades where it was: a copy of it, left on
 * the board for a moment after React Flow takes the real one away. Live
 * cards just go (a copy would start their component again).
 */
export function fadeOut(el: HTMLElement | null) {
  if (!el?.parentElement || el.querySelector("iframe")) return;
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const name of ["data-id", "data-testid", "data-unseen", "tabindex", "role"]) ghost.removeAttribute(name);
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.pointerEvents = "none";
  el.parentElement.appendChild(ghost);
  const at = el.style.transform;
  const end = reduced() ? { opacity: 0, transform: at } : { opacity: 0, transform: `${at} scale(0.96)` };
  ghost.animate([{ opacity: 1, transform: at }, end], { duration: 380, easing: easeOut, fill: "forwards" }).onfinish = () =>
    ghost.remove();
}
