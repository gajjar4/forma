import { animate, type Transition } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { moveItem, slotAt, type GridPlan, type Point } from "./layout";
import type { TileValues } from "./Tile";

type Options = {
  enabled: boolean;
  fieldRef: RefObject<HTMLDivElement | null>;
  plan: GridPlan;
  /** Ids in grid order. */
  order: string[];
  values: Map<string, TileValues>;
  /** Rest position of an image in a slot, in sheet coordinates. */
  slotOf: (id: string, index: number) => Point;
  onOrder: (order: string[]) => void;
  onDrop: (order: string[], before: string[]) => void;
  pickup: Transition;
  drop: Transition;
  dragScale: number;
};

/** How far the pointer moves before a press becomes a drag (px). */
const THRESHOLD = 4;
/** Near the window edge a drag scrolls the field: band width (px) and top speed (px per frame). */
const EDGE = 72;
const EDGE_SPEED = 18;

type DragState = {
  id: string;
  active: boolean;
  start: Point;
  last: Point;
  scroll0: Point;
  pos0: Point;
  order0: string[];
  order: string[];
  raf: number;
};

/**
 * Drag an image to a new slot. The tile follows the pointer while the others
 * make room (the stack re-lays them out as `onOrder` changes the order); on
 * release it settles into its new slot. Holding near an edge scrolls the field.
 */
export function useTileDrag(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const [raisedId, setRaisedId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const current = useRef<DragState | null>(null);

  const onPointerDown = useCallback((e: PointerEvent, id: string) => {
    const o = latest.current;
    const field = o.fieldRef.current;
    const v = o.values.get(id);
    if (!o.enabled || e.button !== 0 || current.current || !field || !v) return;

    const s: DragState = {
      id,
      active: false,
      start: { x: e.clientX, y: e.clientY },
      last: { x: e.clientX, y: e.clientY },
      scroll0: { x: field.scrollLeft, y: field.scrollTop },
      pos0: { x: v.x.get(), y: v.y.get() },
      order0: o.order,
      order: o.order,
      raf: 0,
    };
    current.current = s;
    const box = field.getBoundingClientRect();

    const place = () => {
      const { plan, onOrder } = latest.current;
      const sx = field.scrollLeft;
      const sy = field.scrollTop;
      v.x.set(s.pos0.x + s.last.x - s.start.x + sx - s.scroll0.x);
      v.y.set(s.pos0.y + s.last.y - s.start.y + sy - s.scroll0.y);
      const to = slotAt(plan, { x: s.last.x - box.left + sx, y: s.last.y - box.top + sy });
      const from = s.order.indexOf(id);
      if (from >= 0 && to !== from) {
        s.order = moveItem(s.order, from, to);
        onOrder(s.order);
      }
    };

    const push = (d: number) => (d < EDGE ? ((EDGE - Math.max(0, d)) / EDGE) * EDGE_SPEED : 0);
    const tick = () => {
      if (!latest.current.enabled) return end();
      const dx = push(box.right - s.last.x) - push(s.last.x - box.left);
      const dy = push(box.bottom - s.last.y) - push(s.last.y - box.top);
      if (dx || dy) {
        field.scrollLeft += dx;
        field.scrollTop += dy;
      }
      place();
      s.raf = requestAnimationFrame(tick);
    };

    const move = (ev: globalThis.PointerEvent) => {
      if (!latest.current.enabled) return end();
      s.last = { x: ev.clientX, y: ev.clientY };
      if (!s.active) {
        if (Math.hypot(s.last.x - s.start.x, s.last.y - s.start.y) < THRESHOLD) return;
        s.active = true;
        setRaisedId(id);
        animate(v.scale, latest.current.dragScale, latest.current.pickup);
        s.raf = requestAnimationFrame(tick);
      }
      place();
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cancelAnimationFrame(s.raf);
      current.current = null;
      if (!s.active) return;
      if (!latest.current.enabled) {
        // The stack closed mid-drag; the close flight owns the tile now.
        setRaisedId(null);
        return;
      }
      // The click that follows this release must not lift the image.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const { slotOf, drop, onDrop } = latest.current;
      const rest = slotOf(id, s.order.indexOf(id));
      animate(v.scale, 1, drop);
      Promise.all([animate(v.x, rest.x, drop), animate(v.y, rest.y, drop)]).then(() =>
        setRaisedId((r) => (r === id ? null : r)),
      );
      onDrop(s.order, s.order0);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }, []);

  /** True once, for the click that ends a drag. */
  const consumeClick = useCallback(() => suppressClick.current, []);

  return { raisedId, onPointerDown, consumeClick };
}
