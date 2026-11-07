import { animate, AnimatePresence, motion, useMotionValue, usePresence, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { typing } from "../canvas/useUndo";
import type { Item } from "../model/types";
import { planGrid, sizeIn, slotPosition, stagger } from "./layout";
import { Lift, rectOf, type Rect } from "./Lift";
import {
  CLOSE_SPRING,
  CLOSE_STAGGER,
  CLOSE_STAGGER_MAX,
  DEEP_FADE,
  DEEP_FADE_LEAD,
  DRAG_SCALE,
  DROP_SPRING,
  LIFT_FADE,
  LIFT_SPRING,
  MARGINS,
  OPEN_SPRING,
  OPEN_STAGGER,
  OPEN_STAGGER_MAX,
  PICKUP_SPRING,
  REDUCED_FADE,
  REFLOW_SPRING,
  VEIL_IN,
  VEIL_OUT,
} from "./motion";
import { firstFrame, flyTo, gridOrder, restPose, warmImages, type Stack } from "./opening";
import { poseOnPile, readPile, setPileOut } from "./pile";
import { Tile, type TileValues } from "./Tile";
import { useFieldPan } from "./useFieldPan";
import { useTileDrag } from "./useTileDrag";

type Props = {
  stack: Stack | null;
  onClose: () => void;
  onTakeOut: (itemId: string) => void;
  /** The full new order after a drag, same way round as `stack.items` (last is the cover). */
  onReorder?: (itemIds: string[]) => void;
};

type Phase = "opening" | "open" | "closing";

/**
 * A stack, opened. Its images fly off the pile on the board into a grid laid
 * out around where the stack was, the board blurs back, and the grid is a
 * field you can scroll freely and reorder by dragging. Click an image to lift
 * it; Esc steps back out one level at a time, and the images fly home.
 */
export function FocusView({ stack, ...props }: Props) {
  return <AnimatePresence>{stack && <OpenStack key={stack.id} stack={stack} {...props} />}</AnimatePresence>;
}

function OpenStack({ stack, onClose, onTakeOut, onReorder }: Omit<Props, "stack"> & { stack: Stack }) {
  const [isPresent, safeToRemove] = usePresence();
  const reduced = useReducedMotion() ?? false;
  const [first] = useState(() => firstFrame(stack, reduced));
  const [viewport, setViewport] = useState(first.viewport);
  const [phase, setPhase] = useState<Phase>("opening");
  const phaseRef = useRef<Phase>("opening");
  const fieldRef = useRef<HTMLDivElement>(null);
  const [values] = useState(() => new Map<string, TileValues>());
  const veil = useMotionValue(0);
  const [lift, setLift] = useState<{ id: string; from: Rect; to: Rect | null } | null>(null);
  const liftEl = useRef<HTMLElement | null>(null);

  // Local order, so a drag reads right away even before the board catches up.
  // When the stack's own items change (a reorder saved, an image taken out),
  // they win.
  const itemsKey = stack.items.map((i) => i.id).join("|");
  const [syncedKey, setSyncedKey] = useState(itemsKey);
  const [order, setOrder] = useState(() => gridOrder(stack.items));
  if (syncedKey !== itemsKey) {
    setSyncedKey(itemsKey);
    setOrder(gridOrder(stack.items));
  }

  const byId = useMemo(() => new Map(stack.items.map((i) => [i.id, i])), [stack.items]);
  const items = useMemo(() => order.map((id) => byId.get(id)).filter((i): i is Item => !!i), [order, byId]);
  const plan = useMemo(
    () => planGrid(items.length, viewport, first.anchor, MARGINS),
    [items.length, viewport, first.anchor],
  );
  /** Where each image sits in the pile on the board, cover = 0; also sets stacking order. */
  const pileIndex = useMemo(() => new Map(gridOrder(stack.items).map((id, i) => [id, i])), [stack.items]);

  const latest = useRef({ stack, items, plan, pileIndex, onClose, onTakeOut, onReorder, safeToRemove });
  useLayoutEffect(() => {
    latest.current = { stack, items, plan, pileIndex, onClose, onTakeOut, onReorder, safeToRemove };
  });

  const goto = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // The first frame: sheet scrolled to where the plan put it, the pile on the
  // board hidden, the images drawn exactly over its cards, and every image
  // decoding in the background before it is due to show.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field) {
      field.scrollLeft = first.scroll.x;
      field.scrollTop = first.scroll.y;
    }
    setPileOut(stack.id, true);
    const warm = warmImages(latest.current.stack.items);
    return () => {
      warm.length = 0;
      setPileOut(stack.id, false);
    };
  }, [first, stack.id]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { raisedId, onPointerDown: dragDown, consumeClick } = useTileDrag({
    enabled: phase === "open" && !lift,
    fieldRef,
    plan,
    order: items.map((i) => i.id),
    values,
    slotOf: (id, index) => {
      const item = byId.get(id);
      return item ? slotPosition(plan, index, sizeIn(item, plan.cell)) : { x: 0, y: 0 };
    },
    onOrder: setOrder,
    onDrop: (next, before) => {
      if (next.join("|") !== before.join("|")) latest.current.onReorder?.([...next].reverse());
    },
    pickup: PICKUP_SPRING,
    drop: DROP_SPRING,
    dragScale: DRAG_SCALE,
  });
  const { panning, wasDrag, handlers: pan } = useFieldPan(fieldRef, phase === "open" && !lift && !raisedId);
  const raisedRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    raisedRef.current = raisedId;
  });

  // The opening flight, and afterwards every change of slot (a drag making
  // room, an image taken out, the window resized).
  useEffect(() => {
    if (phaseRef.current === "closing") return;
    if (phaseRef.current === "open") {
      items.forEach((item, i) => {
        const v = values.get(item.id);
        if (!v || item.id === raisedRef.current) return;
        flyTo(v, restPose(plan, i, item), reduced ? { duration: 0 } : REFLOW_SPRING, REDUCED_FADE);
      });
      return;
    }
    animate(veil, 1, reduced ? REDUCED_FADE : VEIL_IN);
    const runs = items.map((item, i) => {
      const v = values.get(item.id);
      if (!v) return null;
      const rest = restPose(plan, i, item);
      if (reduced) return flyTo(v, rest, { duration: 0 }, REDUCED_FADE);
      const delay = stagger(i, items.length, OPEN_STAGGER, OPEN_STAGGER_MAX);
      return flyTo(v, rest, { ...OPEN_SPRING, delay }, { ...DEEP_FADE, delay });
    });
    let live = true;
    Promise.all(runs).then(() => {
      if (live && phaseRef.current === "opening") goto("open");
    });
    return () => {
      live = false;
    };
  }, [items, plan, reduced, values, veil, goto]);

  // Closing: back onto the pile as it is on the board now, deepest first and
  // the cover last, while the board clears. No pile to go to: fade out.
  useEffect(() => {
    const now = latest.current;
    if (isPresent) {
      if (phaseRef.current !== "closing") return;
      // Reopened while closing: come straight back out.
      goto("open");
      setPileOut(now.stack.id, true);
      animate(veil, 1, VEIL_IN);
      now.items.forEach((item, i) => {
        const v = values.get(item.id);
        if (v) flyTo(v, restPose(now.plan, i, item), OPEN_SPRING, DEEP_FADE);
      });
      return;
    }
    goto("closing");
    setLift(null);
    const field = fieldRef.current;
    const scroll = { x: field?.scrollLeft ?? 0, y: field?.scrollTop ?? 0 };
    const pile = reduced ? null : readPile(now.stack.id);
    const fade = reduced ? REDUCED_FADE : VEIL_OUT;
    const runs: Promise<unknown>[] = [Promise.resolve(animate(veil, 0, fade))];
    const count = now.items.length;
    now.items.forEach((item) => {
      const v = values.get(item.id);
      if (!v) return;
      const j = now.pileIndex.get(item.id) ?? count - 1;
      const to = pile && poseOnPile(j, sizeIn(item, now.plan.cell), pile, scroll);
      if (!to) {
        runs.push(Promise.resolve(animate(v.opacity, 0, fade)));
        return;
      }
      const delay = stagger(count - 1 - j, count, CLOSE_STAGGER, CLOSE_STAGGER_MAX);
      const fadeOut =
        to.opacity === 0
          ? { ...DEEP_FADE, delay: delay + CLOSE_SPRING.visualDuration - DEEP_FADE_LEAD }
          : { duration: 0 };
      runs.push(flyTo(v, to, { ...CLOSE_SPRING, delay }, fadeOut));
    });
    let live = true;
    Promise.all(runs).then(() => {
      if (!live) return;
      // Show the real pile first, then drop the copies sitting exactly on it.
      setPileOut(now.stack.id, false);
      latest.current.safeToRemove?.();
    });
    return () => {
      live = false;
    };
  }, [isPresent, reduced, values, veil, goto]);

  const putBack = useCallback(() => {
    setLift((l) => (l && !l.to && liftEl.current ? { ...l, to: rectOf(liftEl.current) } : l));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || phaseRef.current === "closing") return;
      e.stopPropagation();
      // Writing in a lifted note, or an image's note: Esc lets go of the field, the next one puts it back.
      if (typing(e)) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (lift) putBack();
      else latest.current.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lift, putBack]);

  const register = useCallback(
    (id: string, v: TileValues | null) => (v ? values.set(id, v) : values.delete(id)),
    [values],
  );
  const onLift = useCallback(
    (id: string, media: HTMLElement) => {
      if (consumeClick() || phaseRef.current !== "open") return;
      liftEl.current = media;
      setLift({ id, from: rectOf(media), to: null });
    },
    [consumeClick],
  );
  const takeOut = useCallback((id: string) => latest.current.onTakeOut(id), []);
  const tileDown = useCallback((e: PointerEvent, id: string) => dragDown(e, id), [dragDown]);
  const closeOnEmpty = (e: MouseEvent) => {
    if (e.target !== e.currentTarget || wasDrag() || consumeClick() || phaseRef.current === "closing") return;
    onClose();
  };

  const lifted = lift ? byId.get(lift.id) : undefined;

  return (
    <div
      className="focus"
      data-phase={phase}
      data-dragging={raisedId ? "" : undefined}
      data-panning={panning ? "" : undefined}
    >
      <motion.div className="focus-veil" style={{ opacity: veil }} />
      <div className="focus-field" ref={fieldRef} onClick={closeOnEmpty} {...pan}>
        <div className="focus-sheet" style={{ width: plan.sheet.w, height: plan.sheet.h }} onClick={closeOnEmpty}>
          {items.map((item, i) => (
            <Tile
              key={item.id}
              item={item}
              size={sizeIn(item, plan.cell)}
              start={first.starts.get(item.id) ?? { ...restPose(plan, i, item), opacity: 0 }}
              z={items.length - (pileIndex.get(item.id) ?? i)}
              raised={raisedId === item.id}
              lifted={lift?.id === item.id}
              register={register}
              onPointerDown={tileDown}
              onLift={onLift}
              onTakeOut={takeOut}
            />
          ))}
        </div>
      </div>
      <motion.header className="focus-head" style={{ opacity: veil }}>
        <div className="focus-name">
          <h2 className="focus-title">{stack.title}</h2>
          <span className="focus-count">
            {stack.items.length} {stack.items.length === 1 ? "item" : "items"}
          </span>
        </div>
        <button className="focus-close" onClick={() => phaseRef.current !== "closing" && onClose()}>
          Close <kbd>Esc</kbd>
        </button>
      </motion.header>
      <AnimatePresence>
        {lift && lifted && (
          <Lift
            key={lift.id}
            item={lifted}
            from={lift.from}
            to={lift.to}
            reduced={reduced}
            spring={LIFT_SPRING}
            fade={reduced ? REDUCED_FADE : LIFT_FADE}
            onPutBack={putBack}
            onDone={() => setLift(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
