import { useReactFlow, type Node } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { tidy, type LayoutNode, type Placement } from "../model/layout";
import { areaSize } from "../model/operations";
import { GRID } from "./dots";

/** How long things take to glide to their new places. */
const DURATION = 450;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

type Move = { from: Placement; to: Placement };

/**
 * Tidy: lays the board out around the project (see model/layout.ts) and
 * glides everything there, then frames the result. One step to undo.
 */
export function useTidy(commit: () => void) {
  const { getNodes, getEdges, getInternalNode, setNodes, fitView } = useReactFlow();
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return useCallback(() => {
    const nodes = getNodes();
    const sized: LayoutNode[] = nodes.map((n) => {
      const size =
        n.type === "area"
          ? areaSize(n)
          : { w: getInternalNode(n.id)?.measured.width ?? n.measured?.width ?? 0, h: getInternalNode(n.id)?.measured.height ?? n.measured?.height ?? 0 };
      return { id: n.id, type: n.type ?? "", ...n.position, ...size };
    });
    const plan = tidy(sized, getEdges(), GRID);
    const moves = new Map<string, Move>();
    for (const n of sized) {
      const to = plan.get(n.id);
      if (to && (to.x !== n.x || to.y !== n.y || to.w !== n.w || to.h !== n.h)) moves.set(n.id, { from: n, to });
    }
    if (!moves.size) return;

    commit();
    cancelAnimationFrame(frame.current);
    const place = (n: Node, k: number): Node => {
      const m = moves.get(n.id);
      if (!m) return n;
      const at = (a: number, b: number) => a + (b - a) * k;
      const position = { x: at(m.from.x, m.to.x), y: at(m.from.y, m.to.y) };
      return n.type === "area" ? { ...n, position, width: at(m.from.w, m.to.w), height: at(m.from.h, m.to.h) } : { ...n, position };
    };
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setNodes((ns) => ns.map((n) => place(n, easeOut(t))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      // Frame the result once the board has measured the last positions.
      else frame.current = requestAnimationFrame(() => void fitView({ padding: 0.18, duration: 600 }));
    };
    frame.current = requestAnimationFrame(tick);
  }, [commit, fitView, getEdges, getInternalNode, getNodes, setNodes]);
}
