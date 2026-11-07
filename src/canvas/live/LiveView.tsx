import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { Item } from "../../model/types";
import { Lift, rectOf, type Rect } from "../../focus/Lift";
import { LIFT_FADE, LIFT_SPRING, REDUCED_FADE } from "../../focus/motion";
import { holdLive } from "./runner";

export type OpenLive = { id: string; item: Item; from: Rect };

type Props = { open: OpenLive | null; onDone: () => void };

/** A card's box on the board, by the card's id. */
const cardMedia = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"] .card-media`);

/** Where a card's box is on screen now, to land back on (it may have moved). */
function cardRect(id: string): Rect | null {
  const el = cardMedia(id);
  return el ? rectOf(el) : null;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.matches("input, textarea, select"));

/**
 * A card from the board opened big (a picture, a video, a document or a live
 * card): it grows out of its card, with the board blurred behind, the way an
 * image lifts out of an opened stack. Esc or a click around it puts it back.
 */
export function LiveView({ open, onDone }: Props) {
  return open ? <Opened key={open.id} open={open} onDone={onDone} /> : null;
}

function Opened({ open, onDone }: { open: OpenLive; onDone: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const [to, setTo] = useState<Rect | null>(null);
  const putBack = useCallback(() => setTo((t) => t ?? cardRect(open.id) ?? open.from), [open]);

  // The board's own live cards rest while this one has the stage.
  useEffect(() => holdLive(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        putBack();
      } else if ((e.key === "Backspace" || e.key === "Delete") && !typing(e.target)) {
        // Not a delete of the card underneath (typing in a dial still works).
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [putBack]);

  return (
    <Lift
      item={open.item}
      from={open.from}
      to={to}
      reduced={reduced}
      spring={LIFT_SPRING}
      fade={reduced ? REDUCED_FADE : LIFT_FADE}
      onPutBack={putBack}
      onDone={onDone}
      tileOf={() => cardMedia(open.id)}
    />
  );
}
