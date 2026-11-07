// What something dragged onto the board becomes, and where it lands. Pure, so
// a drop from Finder, Safari or Chrome is decided the same way everywhere and
// can be tested without a browser. useDrop does the rest.

import type { Node } from "@xyflow/react";
import { fitInBox } from "./nodes/fit";
import { isPictureOrVideo } from "../model/docs";
import { asUrl, fromPastedText } from "../model/items";
import { itemsOf } from "../model/operations";
import { pushItems, resolveDrop, type Droppable } from "../model/stacking";
import type { Item } from "../model/types";
import { GRID, snapToDots } from "./dots";

/** The parts of a DataTransfer this reads, so tests can pass plain objects. */
export type DropData = {
  files: ArrayLike<File>;
  types: ReadonlyArray<string>;
  getData(type: string): string;
};

export type Dropped =
  | { kind: "files"; files: File[]; source?: string }
  | { kind: "image-url"; url: string; source?: string }
  | { kind: "link"; url: string }
  | { kind: "note"; text: string };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif|svg)$/i;

/** An image or a video, by its type or, when the type is missing, its name. Any other file is a document. */
export const isMediaFile = isPictureOrVideo;

const firstListed = (data: DropData) =>
  data.getData("text/uri-list").split(/\r?\n/).find((l) => l && !l.startsWith("#"));

/** The text on a clipboard or in a drag: plain text, or the first address of a link list. */
export function clipboardText(data: DropData) {
  const plain = data.getData("text/plain");
  if (plain.trim()) return plain;
  return firstListed(data) ?? "";
}

const unescape = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** The first <img> in copied or dragged HTML. */
const htmlImage = (data: DropData) => {
  const src = /<img[^>]+src=["']([^"']+)["']/i.exec(data.getData("text/html"))?.[1];
  return src ? unescape(src) : undefined;
};

/**
 * Where a pasted or dragged image came from, when it was taken off a web
 * page: the browser puts its address beside the picture, as a link (the page
 * it links to, or the image itself) or as the <img> in the HTML.
 */
export function imageSource(data: DropData) {
  for (const candidate of [firstListed(data), htmlImage(data), data.getData("text/plain")]) {
    const url = candidate ? asUrl(candidate) : null;
    if (url) return url;
  }
  return undefined;
}

/** An address an image can be fetched from: on the web, or written into the page as data. */
function fetchable(src: string | undefined) {
  if (!src) return null;
  if (/^data:image\//i.test(src)) return src;
  return asUrl(src);
}

const looksLikeImage = (url: string) => {
  try {
    return IMAGE_EXT.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

/**
 * What a drop is. Files win: images and videos, and any other file as a
 * document (a PDF, a Markdown file, a deck). A picture dragged off a page
 * with no file of its own is fetched by its address. A link becomes a link
 * card and any other text a note, as when pasted.
 */
export function readDrop(data: DropData): Dropped | null {
  const files = Array.from(data.files);
  if (files.length) return { kind: "files", files, source: imageSource(data) };

  const listed = firstListed(data);
  const plain = data.getData("text/plain").trim();
  // A picture comes with an address beside it; selected text with a picture in it doesn't.
  const fromHtml = listed || !plain || asUrl(plain) ? fetchable(htmlImage(data)) : null;
  const image = fromHtml ?? (listed && looksLikeImage(listed) ? asUrl(listed) : null);
  if (image) {
    const source = imageSource(data);
    return { kind: "image-url", url: image, ...(source ? { source } : {}) };
  }

  const text = fromPastedText(clipboardText(data));
  if (!text) return null;
  return text.kind === "link" ? { kind: "link", url: text.url } : { kind: "note", text: text.text };
}

/**
 * Whether a drag going on now could land on the board. While it moves only
 * the kinds of what is carried can be read, not the things themselves. Any
 * file is taken (what isn't a picture or a video is a document); otherwise
 * text, links and pictures off a page.
 */
export function wouldTake(types: ReadonlyArray<string>) {
  if (types.includes("Files")) return true;
  return types.some((t) => t === "text/uri-list" || t === "text/plain" || t === "text/html");
}

/** The stack a drop at this board point files into: the topmost stack under it, unless something sits on top. */
export function stackUnder(p: { x: number; y: number }, things: Droppable[]): string | null {
  const action = resolveDrop({ id: "", type: "card", rect: { x: p.x, y: p.y, w: 0, h: 0 } }, things);
  return action.type === "add-to-stack" ? action.stackId : null;
}

/** How big each thing is on the board once it lands: an image or video card fits a 168 box, a link or a document 200, a note is 256 wide. */
export function landedSize(item: Item): { w: number; h: number } {
  if (item.kind === "note") return { w: 256, h: 120 };
  const { width, height } = fitInBox(item, item.kind === "link" || item.kind === "doc" ? 200 : 168);
  return { w: width, h: height };
}

/** One step of a dropped group: a card's box and a little air. */
export const GROUP_STEP = 7 * GRID;

/**
 * Where dropped things land, as top-left corners on the dots. One thing is
 * centred on the pointer. Several make a small loose group around it, in rows
 * about as many as columns, each centred in its own cell.
 */
export function landingSpots(sizes: { w: number; h: number }[], at: { x: number; y: number }) {
  const cols = Math.ceil(Math.sqrt(sizes.length));
  const rows = Math.ceil(sizes.length / cols);
  return sizes.map((s, i) => {
    const cx = at.x + ((i % cols) - (cols - 1) / 2) * GROUP_STEP;
    const cy = at.y + (Math.floor(i / cols) - (rows - 1) / 2) * GROUP_STEP;
    return snapToDots({ x: cx - s.w / 2, y: cy - s.h / 2 });
  });
}

/** Files items into a stack, on top of the pile, so the last one dropped is the cover. */
export function fileInto(nodes: Node[], stackId: string, items: Item[]): Node[] {
  return nodes.map((n) => (n.id === stackId && n.type === "stack" ? { ...n, data: { ...n.data, items: pushItems(itemsOf(n), items) } } : n));
}
