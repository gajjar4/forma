import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { emphasise, nodeBody, raiseInStack, wireNote } from "./arrive";
import type { Target } from "./search";

/** Quick to start, gentle to land: the same glide as a click on something far away (Canvas.tsx). */
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const GLIDE_MS = 640;

/**
 * Going to what was found. The board glides in to it (to both ends of a
 * wire, so its note sits between them), then it lifts a little so the eye
 * lands on it. An item in a stack glides to the stack, opens it, and lifts
 * the item out of the grid, the way clicking it does.
 */
export function useGoTo(openStack: (stackId: string) => void) {
  const { fitView } = useReactFlow();
  return useCallback(
    async (target: Target) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const wire = target.kind === "wire";
      const ids = wire ? [target.from, target.to] : [target.nodeId];
      await fitView({
        nodes: ids.map((id) => ({ id })),
        maxZoom: 1,
        padding: wire ? 0.3 : 0.6,
        duration: reduced ? 0 : GLIDE_MS,
        ease: easeOutCubic,
      });
      if (target.kind === "item") {
        openStack(target.nodeId);
        raiseInStack(target.itemId, reduced);
      } else emphasise(wire ? wireNote(target.wireId) : nodeBody(target.nodeId));
    },
    [fitView, openStack],
  );
}
