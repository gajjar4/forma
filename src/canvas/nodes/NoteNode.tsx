import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { useState } from "react";
import { asUrl, noteParts } from "../../model/items";
import type { NoteData } from "../../model/types";
import { useCanvasUi } from "../context";
import { useZoomVar } from "../zoom";
import { caretFromPoint, NoteEditor } from "./NoteEditor";
import type { Caret } from "./noteFields";
import { Ports } from "./Ports";
import { SourceMark } from "./SourceMark";

type NoteNodeType = Node<NoteData, "note">;

/**
 * Research in words: a call, a finding, a decision. The first paragraph reads
 * as its heading. Double-click to write in it, the caret where you pressed.
 * Drop it on a stack to file it, or on a card or another note to start a stack.
 */
export function NoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const { updateNodeData } = useReactFlow();
  const { commit, dropTargetId } = useCanvasUi();
  const isTarget = dropTargetId === id;
  /** Set while writing in it: where the caret went in (null for the end). */
  const [editing, setEditing] = useState<{ at: Caret | null } | null>(null);
  useZoomVar();
  const { head, body } = noteParts(data.text);
  const from = data.source ? asUrl(data.source) : null;
  const text = (
    <>
      <div className="note-head" data-empty={head ? undefined : true}>
        {head || "Note"}
      </div>
      {body.map((p, i) => (
        <p key={i} className="note-body">
          {p}
        </p>
      ))}
    </>
  );

  return (
    <motion.div
      className="note"
      data-selected={selected || undefined}
      data-target={isTarget || undefined}
      data-sourced={from ? true : undefined}
      animate={{ scale: isTarget ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      onDoubleClick={(e) => {
        if (editing) return;
        const show = e.currentTarget.querySelector(".note-show");
        setEditing({ at: caretFromPoint(show, e.clientX, e.clientY) });
      }}
    >
      {editing ? (
        <NoteEditor
          look="board"
          text={data.text}
          start={editing.at}
          onSave={(text, again) => {
            // One go at the note is one undo, however often it saved on the way.
            if (!again) commit();
            updateNodeData(id, { text });
          }}
          onLeave={() => setEditing(null)}
        />
      ) : (
        <>
          {/* The hidden copy sizes the note. The one you see sits on top: when
              zoomed out its heading grows and pushes the fading body down,
              inside the same box, so the note never changes size. */}
          <div className="note-text note-size" aria-hidden>
            {text}
          </div>
          <div className="note-text note-show">{text}</div>
        </>
      )}
      {from && <SourceMark url={from} />}
      <Ports />
    </motion.div>
  );
}
