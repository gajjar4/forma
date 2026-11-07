import { useReactFlow } from "@xyflow/react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type Transition } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useCanvasUi } from "../canvas/context";
import { LiveStage } from "../canvas/live/LiveStage";
import { ItemFace } from "../canvas/nodes/Faces";
import { NoteEditor } from "../canvas/nodes/NoteEditor";
import { docType } from "../model/docs";
import { isMedia, itemShape } from "../model/items";
import { patchItem } from "../model/operations";
import { VideoFace } from "../canvas/nodes/VideoFace";
import type { Item } from "../model/types";
import { detailLayout } from "./detail";
import { DOC_READ_WIDTH, DocActions, DocSheet } from "./DocSheet";
import { cornerAt, handoverAt, shadowAt, shadowOver } from "./elevation";
import { ImageDetail } from "./ImageDetail";

/** A box on screen, and the corner it is seen with there (`r`, px), when known. */
export type Rect = { x: number; y: number; w: number; h: number; r?: number };

/** Where an element is on screen, and its corner as seen there (its own radius, scaled with it). */
export const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  const own = el instanceof HTMLElement && el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
  const corner = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return { x: r.left, y: r.top, w: r.width, h: r.height, ...(Number.isFinite(corner) ? { r: corner * own } : {}) };
};

/** A token's length in px, as set in tokens.css. */
const tokenPx = (name: string, fallback: number) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;

/** A live card's dials at its right: their width and the gap (see live.css). */
const DIALS_SIDE = 252;
/** What a live card and its dials keep clear of the window's edges. */
const LIVE_MARGIN = 56;
/**
 * How wide a note comes up. Its face is laid out in container units, so this
 * is the tile grown, line for line; at this width its body reads at about 17px.
 */
const NOTE_WIDTH = 280;

type Props = {
  item: Item;
  /** Where the image was in the grid when it was lifted. */
  from: Rect;
  /** Set when it's being put back: where it lands. */
  to: Rect | null;
  reduced: boolean;
  spring: Transition;
  fade: Transition;
  onPutBack: () => void;
  onDone: () => void;
  /**
   * The box it came out of, which shows again under it as it lands: its tile
   * in an opened stack unless said otherwise (a card on the board).
   */
  tileOf?: () => HTMLElement | null;
};

/** A tile in the opened stack, by its item's id. */
const stackTile = (id: string) => document.querySelector<HTMLElement>(`.focus .ft[data-id="${CSS.escape(id)}"] .ft-media`);

/**
 * One image or note lifted toward you, everything else pushed back. It grows out of
 * its tile and shrinks back into it, so the tile is hidden while it's up. A
 * live card comes up running and takes the pointer, so you can play with it,
 * and a note comes up ready to write in; only a click around them puts it back.
 */
export function Lift({ item, from, to, reduced, spring, fade, onPutBack, onDone, tileOf }: Props) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const shape = itemShape(item);
  const aspect = shape.w / shape.h;
  // A note comes up big enough to read. A live card and its dials
  // are centred together, the card nudged left to make room for them.
  const live = item.kind === "live";
  const most = live ? Math.min(vw * 0.78, vw - DIALS_SIDE - 2 * LIVE_MARGIN) : vw * 0.78;
  // An image keeps room under it for its note, and at its sides for its
  // palette and where it came from.
  const detail = isMedia(item) ? detailLayout({ w: vw, h: vh }, aspect) : null;
  // A document to read comes up a comfortable line wide; a PDF as big as its page fits.
  const widest = item.kind === "note" ? NOTE_WIDTH : item.kind === "doc" && docType(item) !== "pdf" ? DOC_READ_WIDTH : Infinity;
  const w = detail ? detail.image.w : Math.min(most, vh * 0.78 * aspect, widest);
  const h = w / aspect;
  const pose = (r: Rect) => ({ x: r.x + r.w / 2 - vw / 2, y: r.y + r.h / 2 - vh / 2, scale: r.w / w });
  const up = { x: live ? -DIALS_SIDE / 2 : 0, y: detail?.dy ?? 0, scale: 1, opacity: 1 };
  // One flight, shared: the shadow rides the same values as the box, and its
  // corner and shadow are read off its scale (elevation.ts), so they follow
  // the spring exactly, up and home. The tile's corner grows into the lifted
  // one's (--r-panel), and the lifted shadow gathers as it rises, none at the
  // tile, where the tile's own shadow takes over.
  const start = reduced ? up : pose(from);
  const x = useMotionValue(start.x);
  const y = useMotionValue(start.y);
  const scale = useMotionValue(start.scale);
  const home = to ?? from;
  const [upCorner] = useState(() => tokenPx("--r-panel", 14));
  const tileScale = useMotionValue(home.w / w);
  const tileCorner = useMotionValue(home.r ?? upCorner);
  useEffect(() => {
    tileScale.set(home.w / w);
    tileCorner.set(home.r ?? upCorner);
  }, [home.w, home.r, w, upCorner, tileScale, tileCorner]);
  const corner = useTransform(() => cornerAt(scale.get(), tileScale.get(), tileCorner.get(), upCorner));
  // Coming home, the last of the way blends into the real tile under it
  // (elevation.ts): the box and both its shadows fade as the tile shows.
  const homing = useMotionValue(0);
  useEffect(() => homing.set(to && !reduced ? 1 : 0), [to, reduced, homing]);
  // Read every value each time, so the transform follows all of them.
  const handover = useTransform(() => {
    const near = handoverAt(scale.get(), tileScale.get());
    return homing.get() ? near : 1;
  });
  const rise = useTransform(() => shadowAt(scale.get(), tileScale.get()) * handover.get());
  const sink = useTransform(() => (1 - shadowAt(scale.get(), tileScale.get())) * handover.get());
  useMotionValueEvent(handover, "change", (v) => {
    const tile = tileOf ? tileOf() : stackTile(item.id);
    if (tile) tile.style.visibility = v < 1 ? "visible" : "";
  });
  // Landed: the tile is the tile again, hidden the next time it lifts.
  const release = useEffectEvent(() => {
    const tile = tileOf ? tileOf() : stackTile(item.id);
    if (tile) tile.style.visibility = "";
  });
  useEffect(() => () => release(), []);
  // A white card (note, document, link) rests on a soft shadow in its tile.
  // The lifted box carries the same one, sized so that at the tile it is
  // seen exactly as the tile's, and handing over to the lifted shadow as it
  // rises. Both only fade, so the flight never repaints a shadow.
  const card = item.kind === "note" || item.kind === "doc" || item.kind === "link";
  const [restShadow] = useState(() => getComputedStyle(document.documentElement).getPropertyValue("--shadow-rest").trim());
  const restOnTile = card ? shadowOver(restShadow, home.w / w) : undefined;
  const restCorner = card ? (home.r ?? upCorner) / (home.w / w) : undefined;
  const [settled, setSettled] = useState(false);
  const keep = live || item.kind === "note" || item.kind === "doc";
  const media = useRef<HTMLDivElement>(null);
  // A long note or document read further down rolls back to its top on the
  // way home, so it lands as its tile. A PDF's column of pages, before the
  // face of its still.
  useEffect(() => {
    const el = media.current;
    if (to) (el?.querySelector(".doc-pages") ?? el?.querySelector(".face-in"))?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [to, reduced]);

  return (
    <div className="lift" onClick={onPutBack}>
      {/* The veil fades on its own: if the image sat inside it, putting it
          back would fade the image out before it reached its tile. */}
      <motion.div
        className="lift-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: to ? 0 : 1 }}
        transition={fade}
      />
      {/* The shadow it has up close, apart from it, on the same flight, so
          it can thin out as it comes home instead of vanishing all at once
          as it lands. A live card has none: its stage is its own box. With
          reduced motion it simply fades with it. */}
      {card && !reduced && (
        <motion.div
          className="lift-shadow"
          aria-hidden
          style={{ width: w, height: h, x, y, scale, opacity: sink, boxShadow: restOnTile, borderRadius: restCorner }}
        />
      )}
      {!live && (
        <motion.div
          className="lift-shadow"
          aria-hidden
          style={{ width: w, height: h, x, y, scale, ...(reduced ? {} : { opacity: rise }) }}
          initial={reduced ? { opacity: 0 } : undefined}
          animate={reduced ? { opacity: to ? 0 : 1 } : undefined}
          transition={fade}
        />
      )}
      <motion.div
        ref={media}
        className="lift-media"
        data-kind={item.kind}
        style={{ width: w, height: h, x, y, scale, ...(live ? {} : { borderRadius: corner }), ...(reduced ? {} : { opacity: handover }) }}
        onClick={keep ? (e) => e.stopPropagation() : undefined}
        initial={reduced ? { opacity: 0 } : undefined}
        animate={to ? (reduced ? { ...up, opacity: 0 } : pose(to)) : reduced ? up : { x: up.x, y: up.y, scale: up.scale }}
        transition={reduced ? fade : spring}
        onAnimationComplete={() => (to ? onDone() : setSettled(true))}
      >
        {live ? (
          <LiveStage item={item} leaving={!!to} />
        ) : item.kind === "note" ? (
          <NoteSheet item={item} />
        ) : item.kind === "video" ? (
          <VideoFace item={item} big />
        ) : item.kind === "doc" ? (
          <DocSheet item={item} box={{ w, h }} landed={settled} leaving={!!to} />
        ) : (
          <ItemFace item={item} read />
        )}
      </motion.div>
      {detail && <ImageDetail item={item} layout={detail} shown={!to} settled={settled} fade={fade} />}
      {item.kind === "doc" && <DocActions item={item} below={h / 2 + 16} shown={settled && !to} fade={fade} />}
    </div>
  );
}

/** A lifted note: the read face, written in straight away. Esc lets go of it first. */
function NoteSheet({ item }: { item: Item }) {
  const { updateItem } = useCanvasUi();
  const { setNodes } = useReactFlow();
  // One go at the note is one undo: only its first save records one.
  const onSave = (text: string, again: boolean) =>
    again ? setNodes((ns) => patchItem(ns, item.id, { text })) : updateItem(item.id, { text });
  return <NoteEditor look="read" text={item.text ?? ""} onSave={onSave} />;
}
