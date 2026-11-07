import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { inApp } from "./projects";

/**
 * Whether the window is full screen, where the window buttons are gone and
 * the corner is free. In a browser it never is.
 */
export function useFullscreen() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!inApp) return;
    const win = getCurrentWindow();
    let live = true;
    let stop: (() => void) | undefined;
    const check = () => {
      win
        .isFullscreen()
        .then((f) => live && setFull(f))
        .catch(() => {});
    };
    check();
    win
      .onResized(check)
      .then((unlisten) => {
        if (live) stop = unlisten;
        else unlisten();
      })
      .catch(() => {});
    return () => {
      live = false;
      stop?.();
    };
  }, []);
  return full;
}
