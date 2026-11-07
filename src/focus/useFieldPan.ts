import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** How far the pointer must move before a press on empty space counts as a drag, in px. */
const DRAG_FROM = 4;

/**
 * Grab the empty space of an opened stack and drag to move the field, like the
 * board. A press that doesn't move is still a click (which closes the stack);
 * `wasDrag()` tells the click handler to ignore the click that ends a drag.
 */
export function useFieldPan(fieldRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const grab = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [panning, setPanning] = useState(false);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const field = fieldRef.current;
      const target = e.target as HTMLElement;
      const empty = target === field || target.classList.contains("focus-sheet");
      if (!enabled || !field || !empty || e.button !== 0) return;
      dragged.current = false;
      grab.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: field.scrollLeft, top: field.scrollTop, moved: false };
    },
    [enabled, fieldRef],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = grab.current;
      const field = fieldRef.current;
      if (!g || !field || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < DRAG_FROM) return;
        g.moved = true;
        field.setPointerCapture(e.pointerId);
        setPanning(true);
      }
      field.scrollLeft = g.left - dx;
      field.scrollTop = g.top - dy;
    },
    [fieldRef],
  );

  const end = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.id) return;
      dragged.current = g.moved;
      grab.current = null;
      if (g.moved) setPanning(false);
    },
    [],
  );

  /** True once, for the click that ends a drag. */
  const wasDrag = useCallback(() => {
    const d = dragged.current;
    dragged.current = false;
    return d;
  }, []);

  return { panning, wasDrag, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end } };
}
