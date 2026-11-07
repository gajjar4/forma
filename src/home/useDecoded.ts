import { useEffect, useState } from "react";
import { stillOf } from "../model/items";
import type { BoardSummary } from "./summary";

/** Longest the home waits for a slow picture before showing anyway. */
const WAIT_MS = 1200;

const decode = (src: string) => {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => {});
};

/**
 * Whether every picture in the piles is decoded, so the home never shows a
 * pile filling in. False until the boards are known.
 */
export function useDecoded(boards: BoardSummary[] | null): boolean {
  const key = boards
    ? boards
        .flatMap((b) => b.faces.map(stillOf))
        .filter(Boolean)
        .join("\n")
    : null;
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (key === null) return;
    let live = true;
    const srcs = key ? key.split("\n") : [];
    const wait = new Promise((r) => window.setTimeout(r, WAIT_MS));
    void Promise.race([Promise.all(srcs.map(decode)), wait]).then(() => live && setDone(key));
    return () => {
      live = false;
    };
  }, [key]);
  return key !== null && done === key;
}
