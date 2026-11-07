// board.json: the board as a plain file. Written for people and AI tools to
// read and edit by hand, so it stays flat and obvious. FORMAT.md documents it.

import type { Edge, Node } from "@xyflow/react";
import type { AreaData, CardData, Item, LinkData, NoteData, ProjectData, StackData } from "./types";
import { cleanWorkingFiles } from "./workfiles";
import { areaNode, areaSize, NEW_AREA } from "./operations";
import { isHex } from "./palette";
import { grow, type Spot } from "./grow";
import { itemShape } from "./items";

export const FORMAT_VERSION = 1;

/** What new boards used to put in the brief as a prompt. It was never the user's words: read it as no brief. */
const OLD_BRIEF_PROMPT = "What is this project? Double-click a note to start writing.";

/** An item as stored: `file` is a path inside the project folder. */
export type FileItem = Item;

type At = { id: string; x: number; y: number };
export type FileNode =
  | (At & { type: "project"; title: string; brief: string; links?: string[] })
  | (At & { type: "note"; text: string; source?: string })
  | (At & { type: "stack"; title: string; description?: string; items: FileItem[] })
  | (At & { type: "card"; item: FileItem })
  | (At & { type: "area"; w: number; h: number; title: string });

export type FileWire = { id: string; from: string; to: string; note?: string };

export type BoardFile = { forma: number; nodes: FileNode[]; wires: FileWire[] };

export type Board = { nodes: Node[]; edges: Edge[] };

/** Turns a stored file path into something an <img> can show. */
export type Resolve = (file: string) => string;

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * An image's own notes on itself: why it was saved, its colours, where it came
 * from and when. Each one is kept when it is well formed and dropped when it
 * isn't, and an empty note is no note.
 */
function details(item: FileItem): Item {
  const { note, palette, source, added, ...rest } = item;
  const out: Item = rest;
  if (typeof note === "string" && note.trim()) out.note = note;
  const colours = Array.isArray(palette) ? palette.filter(isHex).map((c) => c.toLowerCase()) : [];
  if (colours.length) out.palette = colours;
  if (typeof source === "string" && source.trim()) out.source = source.trim();
  if (typeof added === "string" && /^\d{4}-\d{2}-\d{2}/.test(added) && !Number.isNaN(Date.parse(added))) out.added = added;
  return out;
}

function itemOut(item: Item): FileItem {
  const { src, posterSrc: _poster, ...rest } = details(item);
  // A file in the project is the truth; only keep `src` for things that aren't files yet.
  return rest.file || !src ? rest : { ...rest, src };
}

/**
 * One stored item, checked for what its kind needs: a note has text, a link
 * has a url, an image shows its file through the resolver, a live card
 * runs its file (or its `src`) the same way, and a document needs its file.
 * Anything else is
 * a broken entry and is skipped.
 */
function itemIn(raw: FileItem, resolve: Resolve): Item | null {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string") return null;
  const item = details(raw);
  const kind = item.kind ?? "image";
  if (kind === "note") return { ...item, kind, text: typeof item.text === "string" ? item.text : "" };
  if (kind === "link") return typeof item.url === "string" && item.url ? { ...item, kind } : null;
  if (kind === "live") {
    // A live card is nothing without its component.
    const file = typeof item.file === "string" && item.file ? item.file : undefined;
    const src = typeof item.src === "string" && item.src ? item.src : undefined;
    if (!file && !src) return null;
    return { ...item, kind, src: file ? resolve(file) : src };
  }
  if (kind === "video") {
    // A video plays its file (or its `src`); its poster is a picture file beside it.
    const src = item.file ? resolve(item.file) : item.src;
    if (!src) return null;
    const poster = typeof item.poster === "string" && item.poster ? item.poster : undefined;
    return { ...item, kind, src, ...(poster ? { poster, posterSrc: resolve(poster) } : {}) };
  }
  if (kind === "doc") {
    // A document is its file (or, not yet copied in, its address); a PDF may have a still of its first page.
    const src = typeof item.file === "string" && item.file ? resolve(item.file) : typeof item.src === "string" && item.src ? item.src : undefined;
    if (!src) return null;
    const poster = typeof item.poster === "string" && item.poster ? item.poster : undefined;
    return { ...item, kind, src, ...(poster ? { poster, posterSrc: resolve(poster) } : {}) };
  }
  if (kind !== "image") return null;
  const src = item.file ? resolve(item.file) : item.src;
  return { ...item, kind, src };
}

/** A note node's data, keeping its source only when it says something. */
function noteData(text: unknown, source: unknown): NoteData {
  const t = typeof text === "string" ? text : "";
  return typeof source === "string" && source.trim() ? { text: t, source } : { text: t };
}

export function toBoardFile({ nodes, edges }: Board): BoardFile {
  const out: FileNode[] = [];
  for (const n of nodes) {
    const at = { id: n.id, x: round(n.position.x), y: round(n.position.y) };
    if (n.type === "project") {
      const d = n.data as ProjectData;
      const links = d.links?.length ? { links: d.links } : {};
      out.push({ ...at, type: "project", title: d.title, brief: d.brief, ...links });
    } else if (n.type === "note") {
      const { text, source } = n.data as NoteData;
      out.push({ ...at, type: "note", text, ...(source?.trim() ? { source } : {}) });
    } else if (n.type === "stack") {
      const d = n.data as StackData;
      const description = d.description?.trim() ? { description: d.description } : {};
      out.push({ ...at, type: "stack", title: d.title, ...description, items: d.items.map(itemOut) });
    } else if (n.type === "card") {
      out.push({ ...at, type: "card", item: itemOut((n.data as CardData).item) });
    } else if (n.type === "area") {
      const { w, h } = areaSize(n);
      out.push({ ...at, type: "area", w: round(w), h: round(h), title: (n.data as AreaData).title });
    }
  }
  const wires = edges.map((e) => {
    const note = (e.data as LinkData | undefined)?.note;
    return note ? { id: e.id, from: e.source, to: e.target, note } : { id: e.id, from: e.source, to: e.target };
  });
  return { forma: FORMAT_VERSION, nodes: out, wires };
}

export function serialize(board: Board): string {
  return `${JSON.stringify(toBoardFile(board), null, 2)}\n`;
}

/**
 * Reads board.json. Forgiving on purpose: a hand-edited file with one broken
 * entry still opens, minus that entry. Returns null only when the text isn't a
 * board at all.
 */
export function parseBoard(text: string, resolve: Resolve = (f) => f): Board | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as BoardFile).nodes)) return null;
  const file = raw as BoardFile;

  const nodes: Node[] = [];
  const unplaced = new Set<string>();
  for (const n of file.nodes) {
    if (!n || typeof n.id !== "string") continue;
    // Left out (or not a number), and Forma finds it a place: see model/grow.ts.
    const placed = n.x != null && n.y != null && Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y));
    if (!placed && n.type !== "area") unplaced.add(n.id);
    const position = { x: Number(n.x) || 0, y: Number(n.y) || 0 };
    const base = { id: n.id, position };
    if (n.type === "project") {
      const links = cleanWorkingFiles(n.links);
      nodes.push({ ...base, type: "project", data: { title: n.title ?? "", brief: n.brief === OLD_BRIEF_PROMPT ? "" : (n.brief ?? ""), ...(links.length ? { links } : {}) } });
    } else if (n.type === "note") {
      nodes.push({ ...base, type: "note", data: noteData(n.text, n.source) });
    } else if (n.type === "stack") {
      const items = (Array.isArray(n.items) ? n.items : []).map((i) => itemIn(i, resolve)).filter((i): i is Item => !!i);
      const description = typeof n.description === "string" && n.description.trim() ? { description: n.description } : {};
      nodes.push({ ...base, type: "stack", data: { title: n.title ?? "Stack", ...description, items } });
    } else if (n.type === "card") {
      const item = itemIn(n.item, resolve);
      // A loose note is a note node; take a card that holds one as meaning that.
      if (item?.kind === "note") nodes.push({ ...base, type: "note", data: noteData(item.text, item.source) });
      else if (item) nodes.push({ ...base, type: "card", data: { item } });
    } else if (n.type === "area") {
      nodes.push(areaNode(n.id, { ...position, w: Number(n.w), h: Number(n.h) }, n.title ?? NEW_AREA));
    }
  }

  const ids = new Set(nodes.map((n) => n.id));
  const wires = Array.isArray(file.wires) ? file.wires : [];
  const edges: Edge[] = wires
    .filter((w) => w && ids.has(w.from) && ids.has(w.to) && w.from !== w.to)
    .map((w, i) => ({
      id: typeof w.id === "string" ? w.id : `wire-${i}`,
      source: w.from,
      target: w.to,
      type: "link",
      data: w.note ? { note: w.note } : {},
    }));

  return { nodes: unplaced.size ? placeNew(nodes, edges, unplaced) : nodes, edges };
}

/** About how big a thing is on the board, before the board has measured it. */
export function roughSize(n: Node): { w: number; h: number } {
  if (n.type === "project") return { w: 352, h: 160 };
  if (n.type === "stack") return { w: 200, h: 248 };
  if (n.type === "note") {
    const lines = (n.data as NoteData).text.split("\n").reduce((sum, p) => sum + Math.max(1, Math.ceil(p.length / 32)), 0);
    return { w: 256, h: Math.min(320, Math.max(96, 40 + lines * 20)) };
  }
  if (n.type === "card") {
    const item = (n.data as CardData).item;
    const box = item.kind === "link" || item.kind === "doc" ? 200 : 168;
    const { w, h } = itemShape(item);
    const s = box / Math.max(w, h);
    return { w: Math.round(w * s), h: Math.round(h * s) + 32 };
  }
  return { w: 256, h: 160 };
}

/** Grid the board snaps to; matches canvas/dots.ts. */
const GRID = 32;

function placeNew(nodes: Node[], edges: Edge[], unplaced: Set<string>): Node[] {
  const spots: Spot[] = nodes
    .filter((n) => n.type !== "area")
    .map((n) => ({ id: n.id, type: n.type ?? "", ...roughSize(n), ...(unplaced.has(n.id) ? {} : { at: n.position }) }));
  const at = grow(spots, edges, GRID);
  return nodes.map((n) => (unplaced.has(n.id) && at.has(n.id) ? { ...n, position: at.get(n.id)! } : n));
}
