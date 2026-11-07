import { useReactFlow } from "@xyflow/react";
import { motion, type Transition } from "motion/react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useCanvasUi } from "../canvas/context";
import { openLink } from "../canvas/openLink";
import { dayLabel, isMedia, sourceLabel, stillOf } from "../model/items";
import { patchItem } from "../model/operations";
import type { Item } from "../model/types";
import { paletteOfSrc } from "../store/readPalette";
import { SourceMark } from "../canvas/nodes/SourceMark";
import type { DetailLayout } from "./detail";
import "../styles/detail.css";

type Props = {
  item: Item;
  layout: DetailLayout;
  /** False while the image is being put back. */
  shown: boolean;
  /** True once the image has come all the way up. */
  settled: boolean;
  fade: Transition;
};

/** Clicks in here are for the note, the palette and the link: they never put the image back. */
const keep = (e: MouseEvent) => e.stopPropagation();

/**
 * What sits around a lifted image: why it was saved under it, written
 * straight in, and quietly at its sides its colours and where it came from.
 */
export function ImageDetail({ item, layout, shown, settled, fade }: Props) {
  return (
    <motion.div
      className="detail"
      initial={{ opacity: 0 }}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={shown ? { ...fade, delay: 0.08 } : fade}
      data-shown={shown || undefined}
    >
      <Swatches item={item} layout={layout} settled={settled} />
      <Facts item={item} layout={layout} />
      <NoteField item={item} layout={layout} />
    </motion.div>
  );
}

/** Ids whose palette is being read right now, so lifting twice reads once. */
const reading = new Set<string>();

/**
 * Works out an image's palette the first time it is lifted, once it is all
 * the way up, and keeps it on the item. It is written straight onto the board
 * rather than as an edit: it isn't something you did, so ⌘Z skips it.
 */
function usePalette(item: Item, settled: boolean) {
  const { setNodes } = useReactFlow();
  useEffect(() => {
    const still = stillOf(item);
    if (!settled || !isMedia(item) || item.palette?.length || !still || reading.has(item.id)) return;
    const id = item.id;
    reading.add(id);
    paletteOfSrc(still)
      .then((palette) => {
        if (palette?.length) setNodes((ns) => patchItem(ns, id, { palette }));
      })
      .finally(() => reading.delete(id));
  }, [settled, item, setNodes]);
}

function Swatches({ item, layout, settled }: { item: Item; layout: DetailLayout; settled: boolean }) {
  usePalette(item, settled);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);
  const palette = item.palette ?? [];
  if (!palette.length) return null;

  const copy = (hex: string) => {
    navigator.clipboard?.writeText(hex).then(
      () => setCopied(hex),
      () => {},
    );
  };

  return (
    <div className="detail-swatches" style={{ right: layout.swatches.right, top: layout.swatches.y }} onClick={keep}>
      {palette.map((hex) => (
        <span key={hex} className="detail-swatch-row">
          <span className="detail-hex" data-on={copied === hex || undefined} aria-live="polite">
            {copied === hex ? hex : ""}
          </span>
          <button className="detail-swatch" style={{ background: hex }} aria-label={`Copy ${hex}`} onClick={() => copy(hex)} />
        </span>
      ))}
    </div>
  );
}

function Facts({ item, layout }: { item: Item; layout: DetailLayout }) {
  const source = item.source?.trim() ? sourceLabel(item.source) : null;
  const day = dayLabel(item.added);
  if (!source && !day) return null;
  return (
    <dl className="detail-facts" style={{ left: layout.info.x, top: layout.info.y, maxWidth: Math.min(200, layout.info.w) }} onClick={keep}>
      {source && (
        <div className="detail-fact">
          <dt>Source</dt>
          <dd>
            {source.url && <SourceMark url={source.url} />}
            {source.url ? (
              <a
                href={source.url}
                title={source.url}
                onClick={(e) => {
                  e.preventDefault();
                  openLink(source.url);
                }}
              >
                {source.text}
              </a>
            ) : (
              source.text
            )}
          </dd>
        </div>
      )}
      {day && (
        <div className="detail-fact">
          <dt>Saved</dt>
          <dd>{day}</dd>
        </div>
      )}
    </dl>
  );
}

/** A pause this long in writing saves what's there, as in a note. */
const PAUSE_MS = 1000;

/**
 * Why the image was saved, typed straight in under it. Saved when writing
 * pauses, when you click away, press Esc or put the image back, all of one go
 * at it undoing as one step; while you type, the board's keys stay out of it.
 * Someone else's change (the AI) shows when you aren't typing.
 */
function NoteField({ item, layout }: { item: Item; layout: DetailLayout }) {
  const { updateItem } = useCanvasUi();
  const { setNodes } = useReactFlow();
  /** Saved at least once since writing started: later saves join that undo step. */
  const again = useRef(false);
  const saved = item.note ?? "";
  const [draft, setDraft] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [editing, setEditing] = useState(false);
  if (seen !== saved) {
    setSeen(saved);
    if (!editing) setDraft(saved);
  }
  const field = useRef<HTMLTextAreaElement>(null);

  // Grows with what's written, up to the room under the image.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, layout.note.w]);

  const save = (text: string) => {
    const note = text.trim();
    if (note === saved.trim()) return;
    const patch = { note: note || undefined };
    if (again.current) setNodes((ns) => patchItem(ns, item.id, patch));
    else updateItem(item.id, patch);
    again.current = true;
  };
  // A pause in writing saves it. Every key sets the pause going again.
  const paused = useEffectEvent(() => save(draft));
  useEffect(() => {
    if (!editing) return;
    const t = window.setTimeout(paused, PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [editing, draft]);
  // Taken away while still typing (the view closed under it): keep what's there.
  const onLeave = useEffectEvent(() => {
    if (editing) save(draft);
  });
  useEffect(() => () => onLeave(), []);

  return (
    <textarea
      ref={field}
      className="detail-note"
      style={{ left: layout.note.x, top: layout.note.y, width: layout.note.w, maxHeight: layout.note.maxH }}
      rows={1}
      value={draft}
      placeholder="Why did you save this?"
      aria-label="Why you saved this image"
      spellCheck
      onClick={keep}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        again.current = false;
        setEditing(true);
      }}
      onBlur={() => {
        setEditing(false);
        save(draft);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
