import { useEffect, useEffectEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { typing } from "../canvas/useUndo";

/** ⌘K, from anywhere, even while writing somewhere else. */
export const isCmdK = (e: KeyboardEvent | ReactKeyboardEvent) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k";

/**
 * The keys that open search: ⌘K always, and / when you aren't writing in
 * something. Off while search is open (it takes its own keys then) and while
 * a stack or a live card covers the board.
 */
export function useSearchKeys(enabled: boolean, onOpen: () => void) {
  const open = useEffectEvent(onOpen);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const slash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e);
      if (e.repeat || !(slash || isCmdK(e))) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
