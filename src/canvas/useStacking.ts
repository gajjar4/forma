import { useReactFlow, type Node } from "@xyflow/react";
import { useCallback, useState } from "react";
import { applyDrop } from "../model/operations";
import { resolveDrop, type Droppable } from "../model/stacking";

/**
 * Drag a card or a note onto a stack to file it, onto another card or note to
 * start a stack, or a stack onto a stack to merge them. The target lights up before you let go.
 */
export function useStacking() {
  const { getNodes, getEdges, getInternalNode, setNodes, setEdges } = useReactFlow();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const droppable = useCallback(
    (n: Node): Droppable | null => {
      const internal = getInternalNode(n.id);
      if (!internal) return null;
      const { x, y } = internal.internals.positionAbsolute;
      return { id: n.id, type: n.type ?? "", rect: { x, y, w: internal.measured.width ?? 0, h: internal.measured.height ?? 0 } };
    },
    [getInternalNode],
  );

  const actionFor = useCallback(
    (node: Node) => {
      // Areas never stack, and nothing stacks into one.
      if (node.type === "area") return { type: "none" as const };
      const dragged = droppable(node);
      if (!dragged) return { type: "none" as const };
      // While dragging, the internal position lags a frame behind; use the live one.
      dragged.rect.x = node.position.x;
      dragged.rect.y = node.position.y;
      const others = getNodes()
        .filter((n) => n.id !== node.id && n.type !== "area")
        .map(droppable)
        .filter((d): d is Droppable => d !== null);
      return resolveDrop(dragged, others);
    },
    [droppable, getNodes],
  );

  const onNodeDrag = useCallback(
    (_: unknown, node: Node, dragged: Node[]) => {
      if (dragged.length > 1) return setDropTargetId(null);
      const action = actionFor(node);
      setDropTargetId(
        action.type === "add-to-stack" || action.type === "merge-stacks"
          ? action.stackId
          : action.type === "new-stack"
            ? action.withId
            : null,
      );
    },
    [actionFor],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node, dragged: Node[]) => {
      setDropTargetId(null);
      if (dragged.length > 1) return;
      const action = actionFor(node);
      if (action.type === "none") return;
      const next = applyDrop({ nodes: getNodes(), edges: getEdges() }, node.id, action);
      setNodes(next.nodes);
      setEdges(next.edges);
    },
    [actionFor, getEdges, getNodes, setEdges, setNodes],
  );

  return { dropTargetId, onNodeDrag, onNodeDragStop };
}
