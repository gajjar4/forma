import { useReactFlow, type Edge, type Node } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { emptyHistory, record, redo, undo } from "./history";

type Board = { nodes: Node[]; edges: Edge[] };

/** True when the event is aimed at a text field, which handles its own keys and paste. */
export function typing(e: Event) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

/**
 * ⌘Z and ⇧⌘Z. Call `commit()` right before any change you want to be undoable;
 * it remembers the board as it is now.
 */
export function useUndo() {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();
  const history = useRef(emptyHistory<Board>());

  const commit = useCallback(() => {
    history.current = record(history.current, { nodes: getNodes(), edges: getEdges() });
  }, [getEdges, getNodes]);

  const step = useCallback(
    (dir: "undo" | "redo") => {
      const current = { nodes: getNodes(), edges: getEdges() };
      const out = dir === "undo" ? undo(history.current, current) : redo(history.current, current);
      if (!out) return;
      history.current = out.history;
      setNodes(out.state.nodes.map((n) => ({ ...n, selected: false })));
      setEdges(out.state.edges.map((e) => ({ ...e, selected: false })));
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || typing(e)) return;
      e.preventDefault();
      step(e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  return { commit };
}
