import { motion, useMotionValue, type MotionValue } from "motion/react";
import { memo, useEffect, type PointerEvent } from "react";
import { ItemFace } from "../canvas/nodes/Faces";
import { openLink } from "../canvas/openLink";
import { docTitle } from "../model/docs";
import { hasNote, isMedia, noteParts } from "../model/items";
import type { Item } from "../model/types";
import type { Pose, Size } from "./layout";

export type TileValues = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  rotate: MotionValue<number>;
  opacity: MotionValue<number>;
};

type Props = {
  item: Item;
  /** Drawn size at rest in the grid. */
  size: Size;
  /** Pose on the first frame; after that the motion values are driven from outside. */
  start: Pose;
  z: number;
  raised: boolean;
  lifted: boolean;
  register: (id: string, values: TileValues | null) => void;
  onPointerDown: (e: PointerEvent, id: string) => void;
  onLift: (id: string, media: HTMLElement) => void;
  onTakeOut: (id: string) => void;
};

/** What a screen reader hears for a tile. */
function labelOf(item: Item) {
  if (item.kind === "note") return `Read note: ${noteParts(item.text ?? "").head || "Note"}`;
  if (item.kind === "link") return `Link: ${item.title ?? item.url ?? ""}. Double-click to open.`;
  if (item.kind === "live") return `Open live card: ${item.title ?? "Prototype"}`;
  if (item.kind === "doc") return `Open ${docTitle(item)}`;
  return item.title ?? "Open image";
}

/**
 * One item in an opened stack: an image, a note, a document or a live card (click to lift
 * it; a live card comes up running), or a
 * link (double-click, or the Open pill, opens it). It owns its motion values, so the first frame
 * is drawn exactly at `start` (on the pile) with no flash of the grid, and
 * hands them up so the stack can fly, reorder and close them together.
 */
export const Tile = memo(function Tile({ item, size, start, z, raised, lifted, register, onPointerDown, onLift, onTakeOut }: Props) {
  const x = useMotionValue(start.x);
  const y = useMotionValue(start.y);
  const scale = useMotionValue(start.scale);
  const rotate = useMotionValue(start.rotate);
  const opacity = useMotionValue(start.opacity);

  useEffect(() => {
    register(item.id, { x, y, scale, rotate, opacity });
    return () => register(item.id, null);
  }, [item.id, register, x, y, scale, rotate, opacity]);

  const url = item.kind === "link" ? (item.url ?? "") : null;

  return (
    <motion.div
      className="ft"
      data-id={item.id}
      data-kind={item.kind}
      data-raised={raised || undefined}
      data-lifted={lifted || undefined}
      data-note={hasNote(item) || undefined}
      style={{ x, y, scale, rotate, opacity, width: size.w, height: size.h, zIndex: raised ? 100000 : z }}
      onPointerDown={(e) => onPointerDown(e, item.id)}
    >
      <button
        className="ft-media"
        onClick={url === null ? (e) => onLift(item.id, e.currentTarget) : undefined}
        onDoubleClick={url === null ? undefined : () => openLink(url)}
        aria-label={labelOf(item)}
      >
        <ItemFace item={item} />
      </button>
      <div className="ft-caption">
        <span className="ft-title">{isMedia(item) ? (item.title ?? "") : item.kind === "doc" ? docTitle(item) : ""}</span>
        <span className="ft-actions">
          {url !== null && (
            <button className="ft-pill" onPointerDown={(e) => e.stopPropagation()} onClick={() => openLink(url)}>
              Open
            </button>
          )}
          <button className="ft-pill" onPointerDown={(e) => e.stopPropagation()} onClick={() => onTakeOut(item.id)}>
            Take out
          </button>
        </span>
      </div>
    </motion.div>
  );
});
