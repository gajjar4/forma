import { NodeResizer, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { AREA_MIN } from "../../model/operations";
import type { AreaData } from "../../model/types";
import { useCanvasUi } from "../context";

type AreaNodeType = Node<AreaData, "area">;

/** Areas made a moment ago: they open with their name selected, ready to type over. */
const fresh = new Set<string>();
export const nameOnOpen = (id: string) => fresh.add(id);

/**
 * A soft zone on the board that groups what sits inside it. Only its name and
 * its edges take the pointer: you move it by its name, resize it from its
 * edges and corners, and everywhere else the board behaves as if it weren't
 * there, so you can still select and pan across it.
 */
export function AreaNode({ id, data, selected }: NodeProps<AreaNodeType>) {
  const { updateNodeData } = useReactFlow();
  const { commit } = useCanvasUi();
  const [isNew] = useState(() => fresh.has(id));
  const [renaming, setRenaming] = useState(isNew);
  // A new area and its first name are one step to undo.
  const named = useRef(!isNew);

  useEffect(() => {
    fresh.delete(id);
  }, [id]);

  return (
    <div className="area" data-selected={selected || undefined}>
      <NodeResizer
        minWidth={AREA_MIN.w}
        minHeight={AREA_MIN.h}
        handleClassName="area-handle"
        lineClassName="area-edge"
        onResizeStart={() => commit()}
      />
      {renaming ? (
        <input
          className="area-rename nodrag"
          autoFocus
          defaultValue={data.title}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const title = e.currentTarget.value.trim();
            if (title && title !== data.title) {
              if (named.current) commit();
              updateNodeData(id, { title });
            }
            named.current = true;
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
        />
      ) : (
        <div className="area-title" title="Drag to move with everything in it. Double-click to rename." onDoubleClick={() => setRenaming(true)}>
          {data.title}
        </div>
      )}
    </div>
  );
}
