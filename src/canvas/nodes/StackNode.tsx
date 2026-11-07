import { useReactFlow, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useState, type CSSProperties } from "react";
import { hasNote } from "../../model/items";
import { sharedSource } from "../../model/source";
import type { StackData } from "../../model/types";
import { PILE, titleWidth } from "../body";
import { useCanvasUi } from "../context";
import { useZoomVar } from "../zoom";
import { ItemFace } from "./Faces";
import { fitInBox } from "./fit";
import { pose } from "./pose";
import { SourceMark } from "./SourceMark";
import { Ports } from "./Ports";
import { countLabel } from "./stackKind";

type StackNodeType = Node<StackData, "stack">;

const BOX = 176;

export function StackNode({ id, data, selected }: NodeProps<StackNodeType>) {
  const { dropTargetId, commit } = useCanvasUi();
  const { updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [renaming, setRenaming] = useState(false);
  useZoomVar();
  const isTarget = dropTargetId === id;
  // The last item is the cover; the three before it peek out underneath.
  const shown = data.items.slice(-4).reverse();
  const shared = sharedSource(data.items);

  return (
    <div
      className="stack"
      data-selected={selected || undefined}
      data-target={isTarget || undefined}
      // The bottom port sits under the title, which grows as you zoom out (see
      // body.ts). nodes.css places it from these; React Flow re-reads where it
      // is on hover, so a wire pulled from it starts at its "+".
      style={{ "--tw": Math.round(titleWidth(data.title)), "--desc": data.description ? 1 : 0 } as CSSProperties}
      onMouseEnter={() => updateNodeInternals(id)}
    >
      <div className="stack-pile" style={{ width: PILE, height: PILE }}>
        {shown
          .map((item, i) => {
            const size = fitInBox(item, BOX);
            return (
              <div
                key={item.id}
                className="stack-card"
                data-kind={item.kind}
                // Only the cover shows its note's paper corner: one is a
                // sign, three peeking at once is clutter.
                data-note={(i === 0 && hasNote(item)) || undefined}
                style={{ ...size, ...pose(i), zIndex: 10 - i }}
              >
                <ItemFace item={item} />
                {i === 0 && shared && <SourceMark url={shared} />}
              </div>
            );
          })
          .reverse()}
      </div>
      {/* The label keeps one fixed row in the layout, so the node never changes
          size; what you see sits on top of it and grows when zoomed out. */}
      <div className="stack-label" data-desc={data.description ? true : undefined}>
        <div className="stack-label-in">
          <div className="stack-label-row">
            {renaming ? (
              <input
                className="stack-rename nodrag"
                autoFocus
                defaultValue={data.title}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const title = e.currentTarget.value.trim();
                  if (title && title !== data.title) {
                    commit();
                    updateNodeData(id, { title });
                  }
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                }}
              />
            ) : (
              <span
                className="stack-title"
                title="Double-click to rename"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={() => setRenaming(true)}
              >
                {data.title}
              </span>
            )}
            <span className="stack-count">{countLabel(data.items)}</span>
          </div>
          {data.description && <div className="stack-desc">{data.description}</div>}
        </div>
      </div>
      <Ports />
    </div>
  );
}
