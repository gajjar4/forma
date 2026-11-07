// What the home screen shows of a board: its name, how much is on it, when it
// was last edited, and the few pictures its pile is made of. Pure, so the
// app, the browser build and the tests all read a board the same way.

import type { Board } from "../model/format";
import { isMedia, stillOf } from "../model/items";
import type { CardData, Item, NoteData, ProjectData, StackData } from "../model/types";

/** How many cards a pile shows, cover included, like a stack's. */
export const PILE_FACES = 4;

export type BoardSummary = {
  /** The board's folder (or "browser" for the board kept in the browser). */
  root: string;
  name: string;
  /** Things on the board: everything but areas and the project itself. */
  count: number;
  /** The pile, cover first. */
  faces: Item[];
  /** When board.json was last written, in ms. Null when it isn't known. */
  edited: number | null;
};

/** A picture that can be shown in a pile: an image, or a video with its still. */
const shows = (item: Item | undefined): item is Item => !!item && isMedia(item) && !!stillOf(item);

/**
 * The pile a board is shown as. Pictures first, taken one from each stack
 * (its cover) and each loose card before a second from any, so the pile
 * reads as the whole board and not just its first stack. A board with no
 * pictures shows its notes; an empty one, nothing.
 */
export function pileOf(board: Board, max = PILE_FACES): Item[] {
  // Each place pictures sit, its own pictures in order, cover first.
  const places: Item[][] = [];
  const notes: Item[] = [];
  for (const n of board.nodes) {
    if (n.type === "stack") {
      const items = [...(n.data as StackData).items].reverse();
      places.push(items.filter(shows));
      notes.push(...items.filter((i) => i.kind === "note"));
    } else if (n.type === "card") {
      const item = (n.data as CardData).item;
      if (shows(item)) places.push([item]);
    } else if (n.type === "note") {
      notes.push({ id: n.id, kind: "note", text: (n.data as NoteData).text });
    }
  }
  const out: Item[] = [];
  for (let round = 0; out.length < max && places.some((p) => p.length > round); round++) {
    for (const p of places) {
      if (out.length < max && p[round]) out.push(p[round]);
    }
  }
  return out.length ? out : notes.slice(0, max);
}

/** Things on a board: what you put there. Areas only group them and the project is the board itself. */
export function thingCount(board: Board): number {
  return board.nodes.filter((n) => n.type !== "area" && n.type !== "project").length;
}

/** A board's name: its project's title, else its folder's. */
export function boardName(board: Board, folder: string): string {
  const project = board.nodes.find((n) => n.type === "project");
  const title = (project?.data as ProjectData | undefined)?.title?.trim();
  return title || folder;
}

export function summarize(board: Board, root: string, folder: string, edited: number | null): BoardSummary {
  return { root, name: boardName(board, folder), count: thingCount(board), faces: pileOf(board), edited };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** When a board was edited, as people say it: "today", "yesterday", "2 Nov", or "2 Nov 2025" from another year. */
export function editedLabel(edited: number, now = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(edited)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  const d = new Date(edited);
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

/** The quiet line under a pile: "18 things · edited today". */
export function metaLine({ count, edited }: Pick<BoardSummary, "count" | "edited">, now = Date.now()): string {
  const things = count === 0 ? "Empty" : `${count} ${count === 1 ? "thing" : "things"}`;
  return edited === null ? things : `${things} · edited ${editedLabel(edited, now)}`;
}

/** Most recently edited first; boards with no date after, then by name. Each folder once. */
export function orderBoards(list: BoardSummary[]): BoardSummary[] {
  const seen = new Set<string>();
  const once = list.filter((b) => !seen.has(b.root) && seen.add(b.root));
  return once.sort((a, b) => (b.edited ?? -Infinity) - (a.edited ?? -Infinity) || a.name.localeCompare(b.name));
}

/** The longest folder name a new board gets. */
const NAME_MAX = 64;

/**
 * A folder name made from what was typed: no slashes or colons (macOS reads
 * both as separators), no control characters, no leading dot (a hidden
 * folder), short enough, and never the name of a folder already there
 * (compared without case, like the Mac's disk): "Moodboard 2", "Moodboard 3".
 */
export function folderNameFor(typed: string, taken: Iterable<string>): string {
  const base =
    typed
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[/:\\]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[.\s]+/, "")
      .slice(0, NAME_MAX)
      .trim() || "Untitled";
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
