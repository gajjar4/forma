import { useStoreApi } from "@xyflow/react";
import { useEffect } from "react";
import { haptic } from "../app/haptics";

/**
 * Ticks the trackpad at the moments something catches: a wire being pulled
 * locks onto a port, or a dragged card is about to drop into a stack.
 */
export function useSnapTicks(dropTargetId: string | null) {
  const store = useStoreApi();

  useEffect(
    () =>
      store.subscribe((s, prev) => {
        const now = s.connection.inProgress ? s.connection.toHandle : null;
        const was = prev.connection.inProgress ? prev.connection.toHandle : null;
        if (now && (now.nodeId !== was?.nodeId || now.id !== was?.id)) haptic("alignment");
      }),
    [store],
  );

  useEffect(() => {
    if (dropTargetId) haptic("alignment");
  }, [dropTargetId]);
}
