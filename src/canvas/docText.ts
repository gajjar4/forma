// The words of Markdown and text documents, read once each and kept. A face
// on the board, a tile, the lifted reader and search all ask here, so a file
// is read one time however often it is shown, and never while a frame is
// being drawn: reading is a fetch that resolves later, and a face shows the
// text from then on.

import type { Node } from "@xyflow/react";
import { useEffect, useState } from "react";
import { docType } from "../model/docs";
import type { Item } from "../model/types";

/** How much of a file is read: plenty for reading it, and a long log never fills memory. */
const MOST = 256 * 1024;

const known = new Map<string, string>();
const reading = new Map<string, Promise<string>>();

/** Reads at most `MOST` bytes, as text. */
async function readSome(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok || !res.body) return "";
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (size < MOST) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    parts.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(size, MOST));
  let at = 0;
  for (const p of parts) {
    const take = p.subarray(0, all.length - at);
    all.set(take, at);
    at += take.length;
  }
  return new TextDecoder().decode(all);
}

/** A document's text when it has been read, else undefined. */
export const docTextNow = (src: string | undefined) => (src ? known.get(src) : undefined);

/** A document's text, read the first time it is asked for. Empty when it can't be read. */
export function readDocText(src: string): Promise<string> {
  const ready = known.get(src);
  if (ready !== undefined) return Promise.resolve(ready);
  let pending = reading.get(src);
  if (!pending) {
    pending = readSome(src)
      .catch(() => "")
      .then((text) => {
        known.set(src, text);
        reading.delete(src);
        return text;
      });
    reading.set(src, pending);
  }
  return pending;
}

/** Whether an item's words are worth reading: a Markdown or text document. */
export const hasText = (item: Item) => item.kind === "doc" && !!item.src && docType(item) === "text";

/** Every item on the board: each card's, and everything in the stacks. */
export const itemsOn = (nodes: Node[]): Item[] =>
  nodes.flatMap((n) => {
    const d = n.data as { item?: Item; items?: Item[] };
    return n.type === "stack" ? (d.items ?? []) : n.type === "card" && d.item ? [d.item] : [];
  });

/** Reads the words of every text document among `items` that hasn't been read. Resolves true when any were new. */
export async function readAll(items: Item[]): Promise<boolean> {
  const unread = items.filter((i) => hasText(i) && docTextNow(i.src) === undefined);
  await Promise.all(unread.map((i) => readDocText(i.src!)));
  return unread.length > 0;
}

/** A text document's words, for a face or the reader: undefined until they arrive. */
export function useDocText(item: Item): string | undefined {
  const src = hasText(item) ? item.src : undefined;
  const [read, setRead] = useState<{ src: string; text: string } | null>(() => {
    const now = docTextNow(src);
    return src && now !== undefined ? { src, text: now } : null;
  });
  useEffect(() => {
    if (!src || docTextNow(src) !== undefined) return;
    let live = true;
    void readDocText(src).then((text) => live && setRead({ src, text }));
    return () => {
      live = false;
    };
  }, [src]);
  // Read for another file (the item changed): what's known now, if anything.
  if (read && read.src === src) return read.text;
  return docTextNow(src);
}
