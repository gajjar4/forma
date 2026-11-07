// Things dragged onto the board from outside: files from Finder, and pictures,
// links and text from Safari or Chrome. The webview's own file drop is off in
// the app (dragDropEnabled in tauri.conf.json), so the page gets ordinary HTML
// drops for all of them, Finder files included, the same as in a browser.

import { useReactFlow, type Node } from "@xyflow/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { haptic } from "../app/haptics";
import { isoDay } from "../model/items";
import { newId, nodeFromItem } from "../model/operations";
import type { Droppable } from "../model/stacking";
import type { Item } from "../model/types";
import type { BoardStore } from "../store/types";
import { snapToDots } from "./dots";
import { fileInto, landedSize, landingSpots, readDrop, stackUnder, wouldTake, type Dropped } from "./dropData";
import { dropAt } from "./gridFx";
import { typing } from "./useUndo";

type Options = {
  store: BoardStore;
  commit: () => void;
  /** Off while a stack or a live card is open, so nothing lands on the board behind it. */
  enabled: boolean;
};

/** The board, while one is open: told about every drag from outside. */
type Target = {
  /** True when the drag would land; it shows where. */
  over(e: DragEvent): boolean;
  drop(e: DragEvent): void;
  leave(): void;
};

let target: Target | null = null;
/** A drag that started in the app itself (selected text): left to the page. */
let fromPage = false;
/** Elements the drag is inside; at 0 it has left the window. */
let depth = 0;

const hasFiles = (data: DataTransfer) => data.types.includes("Files");

/**
 * Every drag from outside passes through here, board or not. Whatever the
 * board doesn't take is still held, because the webview would otherwise open
 * a dropped file in place of the app. Text dragged into a text field goes in
 * as usual.
 */
function onDragOver(e: DragEvent) {
  const data = e.dataTransfer;
  if (!data || fromPage) return;
  if (e.type === "dragenter") depth++;
  if (typing(e) && !hasFiles(data)) return target?.leave();
  e.preventDefault();
  const taken = !typing(e) && !!target?.over(e);
  if (!taken) target?.leave();
  data.dropEffect = taken ? "copy" : "none";
}

function onDragLeave(e: DragEvent) {
  if (fromPage || !e.dataTransfer) return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) target?.leave();
}

function onDrop(e: DragEvent) {
  depth = 0;
  const data = e.dataTransfer;
  if (!data || fromPage) return;
  if (typing(e) && !hasFiles(data)) return target?.leave();
  e.preventDefault();
  if (typing(e)) target?.leave();
  else target?.drop(e);
}

if (typeof window !== "undefined") {
  window.addEventListener("dragstart", () => (fromPage = true));
  window.addEventListener("dragend", () => (fromPage = false));
  window.addEventListener("dragenter", onDragOver);
  window.addEventListener("dragover", onDragOver);
  window.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", onDrop);
}

/** A picture fetched from the web as a file, for the store to copy in. Null when the site won't hand it over. */
async function fetchImage(url: string): Promise<File | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const blob = res.ok ? await res.blob() : null;
    if (!blob?.type.startsWith("image/")) return null;
    const name = url.startsWith("data:") ? "image" : decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}

/** A picture kept by its web address, for a site that won't let it be fetched (no palette then). */
function webImage(url: string, source: string): Promise<Item | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ id: newId("item"), kind: "image", src: url, w: img.naturalWidth || 1, h: img.naturalHeight || 1, source, added: isoDay() });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** What a drop brings: images, videos and documents copied into the project, a link card, or a note. */
async function itemsFrom(dropped: Dropped, store: BoardStore): Promise<Item[]> {
  if (dropped.kind === "note") return [{ id: newId("note"), kind: "note", text: dropped.text }];
  if (dropped.kind === "link") return [{ id: newId("item"), kind: "link", url: dropped.url }];
  if (dropped.kind === "files") {
    const read = await Promise.allSettled(dropped.files.map((f) => store.importMedia(f, dropped.source)));
    return read.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  }
  const web = dropped.url.startsWith("data:") ? undefined : dropped.url;
  const source = dropped.source ?? web;
  const file = await fetchImage(dropped.url);
  if (file) return [await store.importMedia(file, source)];
  const held = web && (await webImage(web, source ?? web));
  if (held) return [held];
  return source ? [{ id: newId("item"), kind: "link", url: source }] : [];
}

/**
 * Drag things onto the board from outside the app. They land where they are
 * let go, on the dots, selected, and ⌘Z takes them back; let go over a stack,
 * they are filed into it. While the drag is over the board a "+" gathers on
 * the dot it would land on, and a stack it would go into shows it.
 *
 * Returns the stack the drag is over, to be shown like any drop target.
 */
export function useDrop(options: Options): string | null {
  const { getInternalNode, getNodes, screenToFlowPosition, setNodes } = useReactFlow();
  const [over, setOver] = useState<string | null>(null);
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    let aimed: string | null = null;

    const things = () =>
      getNodes().flatMap((n): Droppable[] => {
        const internal = n.type === "area" ? undefined : getInternalNode(n.id);
        if (!internal || n.hidden) return [];
        const { x, y } = internal.internals.positionAbsolute;
        return [{ id: n.id, type: n.type ?? "", rect: { x, y, w: internal.measured.width ?? 0, h: internal.measured.height ?? 0 } }];
      });

    const aim = (stackId: string | null) => {
      if (stackId === aimed) return;
      aimed = stackId;
      setOver(stackId);
      if (stackId) haptic("alignment");
    };

    const leave = () => {
      aim(null);
      dropAt(null);
    };

    const land = async (dropped: Dropped, at: { x: number; y: number }, stackId: string | null) => {
      const items = await itemsFrom(dropped, latest.current.store);
      if (!items.length) return;
      latest.current.commit();
      if (stackId && getNodes().some((n) => n.id === stackId)) {
        setNodes((ns) => fileInto(ns, stackId, items));
        return;
      }
      const spots = landingSpots(items.map(landedSize), at);
      const placed: Node[] = items.map((item, i) => ({ ...nodeFromItem(item, spots[i]), selected: true }));
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...placed]);
    };

    const onBoard = (e: DragEvent) => e.target instanceof Element && !!e.target.closest(".react-flow");

    const mine: Target = {
      over(e) {
        const data = e.dataTransfer;
        if (!latest.current.enabled || !data || !onBoard(e) || !wouldTake(data.types)) return false;
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const stackId = stackUnder(p, things());
        aim(stackId);
        dropAt(stackId ? null : snapToDots(p));
        return true;
      },
      drop(e) {
        // Read now: the drag's contents are gone once the event is over.
        const dropped = latest.current.enabled && e.dataTransfer && onBoard(e) ? readDrop(e.dataTransfer) : null;
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const stackId = stackUnder(p, things());
        leave();
        if (dropped) void land(dropped, p, stackId);
      },
      leave,
    };

    target = mine;
    return () => {
      if (target === mine) target = null;
      dropAt(null);
    };
  }, [getInternalNode, getNodes, screenToFlowPosition, setNodes]);

  return over;
}
