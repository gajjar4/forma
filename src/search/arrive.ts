// Arriving at what was found: a soft lift on it so the eye lands there. All
// of it is a data attribute on the thing's own element and a CSS animation
// (search.css), so the board itself never re-renders for it.

const esc = (id: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id);

/** A thing's body on the board: what its node draws, inside React Flow's wrapper. */
export const nodeBody = (id: string) =>
  document.querySelector<HTMLElement>(`.react-flow__node[data-id="${esc(id)}"]`)?.firstElementChild as HTMLElement | null;

/** A wire's note on the board. */
export const wireNote = (id: string) => document.querySelector<HTMLElement>(`.wire-label[data-wire="${esc(id)}"] .wire-note`);

/** How long the lift takes, in and back (search.css). The attribute is dropped after it either way. */
const FOUND_MS = 1000;

/** Lifts `el` a little and lets it settle back, once. Again on the same thing starts it over. */
export function emphasise(el: Element | null | undefined) {
  if (!el) return;
  el.removeAttribute("data-found");
  // A frame without it, so a second find runs the animation from the start.
  requestAnimationFrame(() => {
    el.setAttribute("data-found", "");
    window.setTimeout(() => el.removeAttribute("data-found"), FOUND_MS + 100);
  });
}

/** How long a stack gets to open before the search gives up on lifting its item. */
const OPEN_WAIT = 3000;

/** Calls `then` with the opened stack once its images have landed in the grid. */
function whenOpen(then: (focus: HTMLElement) => void) {
  const until = performance.now() + OPEN_WAIT;
  const look = () => {
    const focus = document.querySelector<HTMLElement>(".focus");
    if (!focus) {
      if (performance.now() < until) requestAnimationFrame(look);
      return;
    }
    if (focus.dataset.phase === "open") return then(focus);
    const watch = new MutationObserver(() => {
      if (focus.dataset.phase === "open") {
        watch.disconnect();
        then(focus);
      } else if (focus.dataset.phase === "closing") watch.disconnect();
    });
    watch.observe(focus, { attributes: true, attributeFilter: ["data-phase"] });
    window.setTimeout(() => watch.disconnect(), OPEN_WAIT);
  };
  requestAnimationFrame(look);
}

/** How long a smooth scroll in the opened stack takes to bring a tile into view. */
const SCROLL_MS = 420;

/**
 * In the stack that is opening, brings the item into view and lifts it, the
 * way a click on it does: an image comes up with its note, a note ready to
 * read. A link has no lift, so it gets the soft emphasis instead.
 */
export function raiseInStack(itemId: string, reduced: boolean) {
  whenOpen((focus) => {
    const tile = focus.querySelector<HTMLElement>(`.ft[data-id="${esc(itemId)}"]`);
    const media = tile?.querySelector<HTMLElement>(".ft-media");
    const field = focus.querySelector<HTMLElement>(".focus-field");
    if (!tile || !media || !field) return;
    const r = media.getBoundingClientRect();
    const inView = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    if (!inView) {
      const left = r.left + r.width / 2 - window.innerWidth / 2;
      const top = r.top + r.height / 2 - window.innerHeight / 2;
      field.scrollBy({ left, top, behavior: reduced ? "auto" : "smooth" });
    }
    window.setTimeout(
      () => {
        if (focus.dataset.phase !== "open") return;
        if (tile.dataset.kind === "link") emphasise(media);
        else media.click();
      },
      inView || reduced ? 0 : SCROLL_MS,
    );
  });
}
