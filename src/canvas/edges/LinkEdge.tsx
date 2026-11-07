import {
  EdgeLabelRenderer,
  useInternalNode,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { useState } from "react";
import { aroundNote, cubicPath, NOTE_FADE, noteHalfWidth, noteRoom, wireEnds, wireFade, wirePath, type Cubic } from "../../model/geometry";
import type { LinkData } from "../../model/types";
import { bodyOf } from "../body";
import { useCanvasUi } from "../context";
import { detailShows, useLabelZoom } from "../zoom";

/** How much wider than its quiet text a note's pill is on each side, in board units (padding plus a hair). */
const PILL_PAD = 8;

type LinkEdgeType = Edge<LinkData, "link">;

/**
 * A wire between two things. It always runs between the sides that face each
 * other. A note can sit on it (double-click the wire or the note to edit).
 */
export function LinkEdge({ id, source, target, data, selected }: EdgeProps<LinkEdgeType>) {
  const a = useInternalNode(source);
  const b = useInternalNode(target);
  const { updateEdgeData } = useReactFlow();
  const { commit } = useCanvasUi();
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  // The zoom titles are drawn for. It only changes when a zoom comes to rest,
  // so wires re-render once then, never on every frame of a zoom.
  const zoom = useLabelZoom();
  if (!a || !b) return null;

  // Ends on the things themselves (a stack's pile), and below any title.
  const [s, t] = wireEnds(bodyOf(a, zoom), bodyOf(b, zoom));
  const { path, mid, curve } = wirePath(s, t);
  const fade = wireFade(s, t);
  const gradient = `wire-fade-${id}`;
  const note = data?.note;
  const hot = selected || hover;
  // Zoomed out (notes hidden) it is one whole line. Only one version is drawn
  // at a time, which keeps zooming cheap.
  // The line never runs under its note, so nothing flashes while the pill
  // grows. At rest it fades out toward the words; hovered (or being written
  // on) it runs solid right up to the pill's edge and stops under it.
  const loudNote = hot || editing;
  // On a short wire the words would reach the things it connects, so at rest
  // the note stops where the gap does and ends in an ellipsis; hovered, the
  // whole note shows as its pill, on top of everything.
  const room = note ? noteRoom(s, t, noteHalfWidth(note) * 2) : null;
  const quietHalf = note ? (room ? room / 2 : noteHalfWidth(note)) : 0;
  const cut =
    note && detailShows(zoom, true)
      ? aroundNote(curve, loudNote ? noteHalfWidth(note) + PILL_PAD : quietHalf)
      : null;
  // The note shows as a white pill when the wire is hovered, selected or
  // being written on.
  const loud = hot || editing;

  const save = (value: string) => {
    const next = value.trim() || undefined;
    if (next !== note) {
      commit();
      updateEdgeData(id, { note: next });
    }
    setEditing(false);
  };

  return (
    <>
      {/* A thin line that fades in out of one thing and out into the other: no hard ends. */}
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1={s.x} y1={s.y} x2={t.x} y2={t.y}>
          <stop offset={0} className="wire-stop" data-hot={hot || undefined} stopOpacity={0} />
          <stop offset={fade.start} className="wire-stop" data-hot={hot || undefined} />
          <stop offset={fade.end} className="wire-stop" data-hot={hot || undefined} />
          <stop offset={1} className="wire-stop" data-hot={hot || undefined} stopOpacity={0} />
        </linearGradient>
      </defs>
      {!cut && <path d={path} className="wire" stroke={`url(#${gradient})`} data-hot={hot || undefined} />}
      {cut && (
        <>
          {cut.before && (
            <WirePart id={`${gradient}-a`} curve={cut.before} fadeIn={wireFade(s, t).start} hot={hot} into="end" soft={!loudNote} />
          )}
          {cut.after && (
            <WirePart id={`${gradient}-b`} curve={cut.after} fadeIn={wireFade(s, t).start} hot={hot} into="start" soft={!loudNote} />
          )}
        </>
      )}
      <path
        d={path}
        className="wire-hit"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDoubleClick={() => setEditing(true)}
      />
      <EdgeLabelRenderer>
        <div
          className="wire-label nodrag nopan"
          data-wire={id}
          data-hot={loud || undefined}
          style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)` }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {editing ? (
            <input
              className="wire-input"
              autoFocus
              defaultValue={note ?? ""}
              placeholder="Why are these connected?"
              onBlur={(e) => save(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              }}
            />
          ) : note ? (
            <button
              className="wire-note"
              style={room && !loud ? { maxWidth: room } : undefined}
              onDoubleClick={() => setEditing(true)}
            >
              {note}
            </button>
          ) : (
            <button
              className="wire-add"
              data-show={hover || undefined}
              aria-label="Add a note to this connection"
              title="Add a note"
              onClick={() => setEditing(true)}
            >
              {/* Drawn, not typed: a text "+" never sits quite in the centre. */}
              <svg viewBox="0 0 10 10" aria-hidden>
                <path d="M5 1.5v7M1.5 5h7" />
              </svg>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * One side of a wire cut at its note: fades in from its card as the whole wire
 * does, and fades out toward the note (`into` says which end meets the note).
 */
function WirePart({
  id,
  curve,
  fadeIn,
  hot,
  into,
  soft,
}: {
  id: string;
  curve: Cubic;
  fadeIn: number;
  hot: boolean;
  into: "start" | "end";
  /** Fade out toward the note (at rest); otherwise end crisply under the pill. */
  soft: boolean;
}) {
  const [a, , , d] = curve;
  const length = Math.hypot(d.x - a.x, d.y - a.y) || 1;
  const toNote = Math.min(0.45, (soft ? NOTE_FADE : 2) / length);
  const fromCard = Math.min(0.45, fadeIn * 2);
  // Stops run from the curve's start to its end.
  const stops =
    into === "end"
      ? [[0, 0], [fromCard, 1], [1 - toNote, 1], [1, 0]]
      : [[0, 0], [toNote, 1], [1 - fromCard, 1], [1, 0]];
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={d.x} y2={d.y}>
          {stops.map(([offset, opacity]) => (
            <stop key={offset} offset={offset} className="wire-stop" data-hot={hot || undefined} stopOpacity={opacity} />
          ))}
        </linearGradient>
      </defs>
      <path d={cubicPath(curve)} className="wire wire-part" stroke={`url(#${id})`} data-hot={hot || undefined} />
    </>
  );
}
