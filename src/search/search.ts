// Finding things on the board by their words. Pure: the board goes in once as
// an index, and every keystroke is a quick pass over it.

import type { Edge, Node } from "@xyflow/react";
import { docFileName, docTitle, isMarkdown } from "../model/docs";
import { markdownWords } from "../model/markdown";
import { asUrl, hostOf, noteParts, pictureOf } from "../model/items";
import type { AreaData, CardData, Item, LinkData, NoteData, ProjectData, StackData } from "../model/types";

/** Where a find takes you: a thing on the board, an item in a stack, or a wire's two ends. */
export type Target =
  | { kind: "node"; nodeId: string }
  | { kind: "item"; nodeId: string; itemId: string }
  | { kind: "wire"; wireId: string; from: string; to: string };

/** The small picture at the start of a result: a still, or a site's icon. */
export type Thumb = { still: string } | { site: string } | null;

/** How strongly a match in this field counts: a name, the words, or where it came from. */
type Weight = "name" | "words" | "where";

type Field = { text: string; weight: Weight; folded: Folded };

export type Entry = {
  key: string;
  target: Target;
  /** Its words, the name (a title or a note's heading) first when it has one. */
  fields: Field[];
  /** The quiet line saying what it is or where it sits: "note", "in Motion". */
  meta: string;
  thumb: Thumb;
  /** The newest `added` in it, for ranking ties. */
  added: string;
  order: number;
};

/** A run of text with the parts that matched marked. */
export type Marked = { text: string; marks: [number, number][] };

export type Result = {
  key: string;
  target: Target;
  /** The line shown: the name, or the matching words when it has none. */
  line: Marked;
  /** The words that matched when the name alone doesn't say why it is here. */
  snippet: Marked | null;
  meta: string;
  thumb: Thumb;
};

// Folding: case and accents away, with a map back to the original text so a
// match can be marked where it is.

type Folded = { text: string; starts: number[]; ends: number[] };

const MARKS = /\p{M}/gu;

export function fold(text: string): Folded {
  let out = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  for (const ch of text) {
    const f = ch.toLowerCase().normalize("NFD").replace(MARKS, "");
    for (let i = 0; i < f.length; i++) {
      starts.push(at);
      ends.push(at + ch.length);
    }
    out += f;
    at += ch.length;
  }
  return { text: out, starts, ends };
}

/** The words of a query, folded. */
export function words(query: string) {
  return fold(query).text.split(/\s+/).filter(Boolean);
}

const WORDY = /[\p{L}\p{N}]/u;

/** Where `word` first starts a word in `text`, else where it first appears, else -1. */
function find(text: string, word: string): { at: number; start: boolean } | null {
  let first = -1;
  for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) {
    if (i === 0 || !WORDY.test(text[i - 1])) return { at: i, start: true };
    if (first < 0) first = i;
  }
  return first < 0 ? null : { at: first, start: false };
}

const POINTS: Record<Weight, number> = { name: 4, words: 2, where: 1.5 };

/** Every place any of the words appears, as ranges of the original text, merged. */
function marksIn(field: Folded, ws: string[]): [number, number][] {
  const raw: [number, number][] = [];
  for (const w of ws) {
    for (let i = field.text.indexOf(w); i >= 0; i = field.text.indexOf(w, i + w.length)) {
      raw.push([field.starts[i], field.ends[i + w.length - 1]]);
    }
  }
  raw.sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** How much of a long text to keep before its first match. */
const LEAD = 24;

/** A long text cut to start a little before its first match, at a word. */
function around(text: string, marks: [number, number][]): Marked {
  const first = marks[0]?.[0] ?? 0;
  if (first <= LEAD) return { text, marks };
  const space = text.lastIndexOf(" ", first - LEAD);
  const cut = space < 0 ? first - LEAD : space + 1;
  const shift = cut - 1;
  return { text: `…${text.slice(cut)}`, marks: marks.map(([a, b]) => [a - shift, b - shift]) };
}

/**
 * The things on the board that have every word of the query somewhere in
 * them, best first: a word in a name counts most, then in the words, then in
 * where it came from, and a word's start more than its middle. Ties go to
 * what was added last, then to the board's own order.
 */
export function search(index: Entry[], query: string, limit = 8): Result[] {
  const ws = words(query);
  if (!ws.length) return [];
  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of index) {
    let score = 0;
    let all = true;
    for (const w of ws) {
      let best = 0;
      for (const f of entry.fields) {
        const hit = find(f.folded.text, w);
        if (hit) best = Math.max(best, POINTS[f.weight] + (hit.start ? 1 : 0));
      }
      if (!best) {
        all = false;
        break;
      }
      score += best;
    }
    if (!all) continue;
    const name = entry.fields[0]?.weight === "name" ? entry.fields[0].folded.text : "";
    if (name.startsWith(ws.join(" "))) score += 2;
    scored.push({ entry, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || b.entry.added.localeCompare(a.entry.added) || a.entry.order - b.entry.order,
  );
  return scored.slice(0, limit).map(({ entry }) => present(entry, ws));
}

/** What a result shows: its name with the matches marked, and why it matched when the name doesn't say. */
function present(entry: Entry, ws: string[]): Result {
  const named = entry.fields[0]?.weight === "name" ? entry.fields[0] : null;
  const missing = named ? ws.filter((w) => !named.folded.text.includes(w)) : ws;
  // The field that explains the rest: the one holding most of what the name doesn't.
  let why: Field | null = null;
  let most = 0;
  for (const f of entry.fields) {
    if (f === named) continue;
    const n = missing.filter((w) => f.folded.text.includes(w)).length;
    if (n > most) {
      most = n;
      why = f;
    }
  }
  const mark = (f: Field) => around(f.text, marksIn(f.folded, ws));
  const line = named ? mark(named) : why ? mark(why) : { text: "", marks: [] };
  const snippet = named && why && missing.length ? mark(why) : null;
  return { key: entry.key, target: entry.target, line, snippet, meta: entry.meta, thumb: entry.thumb };
}

// Building the index from the board.

const field = (text: string | undefined, weight: Weight): Field[] => {
  const t = text?.replace(/\s+/g, " ").trim();
  return t ? [{ text: t, weight, folded: fold(t) }] : [];
};

/** An address as it reads: no scheme, no www., no trailing slash. */
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

/** Where something came from, as text to search: a site by its address, a name as written. */
const where = (source: string | undefined) => {
  const url = source ? asUrl(source) : null;
  return field(url ? bare(url) : source, "where");
};

const KIND_WORD: Record<Item["kind"], string> = { image: "image", video: "video", link: "link", note: "note", live: "live card", doc: "document" };

/** How much of a document's words are searched: its opening, which says what it is. */
const DOC_WORDS = 4000;

/**
 * The words of Markdown and text documents, by their address, as far as they
 * have been read (canvas/docText.ts reads them). Passed in, so this stays pure.
 */
export type DocWords = (src: string | undefined) => string | undefined;

function itemThumb(item: Item): Thumb {
  const still = pictureOf(item);
  if (still) return { still };
  if (item.kind === "link" && item.url) return { site: item.url };
  const source = item.source ? asUrl(item.source) : null;
  return source ? { site: source } : null;
}

/** An item's words: its name first, then what it says, then where it came from. */
function itemFields(item: Item, docWords: DocWords): Field[] {
  if (item.kind === "doc") {
    const read = docWords(item.src)?.slice(0, DOC_WORDS);
    const text = read && isMarkdown(item) ? markdownWords(read) : read;
    return [...field(docTitle(item), "name"), ...field(item.note, "words"), ...field(text, "words"), ...field(docFileName(item), "where"), ...where(item.source)];
  }
  if (item.kind === "note") {
    const { head, body } = noteParts(item.text ?? "");
    return [...field(head, "name"), ...field(body.join(" "), "words"), ...where(item.source)];
  }
  if (item.kind === "link") {
    const name = item.title?.trim() || hostOf(item.url ?? "");
    const url = item.url ? field(bare(item.url), "where") : [];
    return [...field(name, "name"), ...field(item.note, "words"), ...url, ...where(item.source)];
  }
  return [...field(item.title, "name"), ...field(item.note, "words"), ...where(item.source)];
}

/** Everything on the board with words on it, ready to search. Stack items are their own entries. */
export function indexBoard(nodes: Node[], edges: Edge[], docWords: DocWords = () => undefined): Entry[] {
  const out: Entry[] = [];
  const push = (e: Omit<Entry, "order">) => {
    if (e.fields.length) out.push({ ...e, order: out.length });
  };
  for (const node of nodes) {
    const at: Target = { kind: "node", nodeId: node.id };
    if (node.type === "project") {
      const d = node.data as ProjectData;
      const links = (d.links ?? []).flatMap((l) => field(bare(l), "where"));
      push({ key: node.id, target: at, fields: [...field(d.title, "name"), ...field(d.brief, "words"), ...links], meta: "project", thumb: null, added: "" });
    } else if (node.type === "note") {
      const d = node.data as NoteData;
      const { head, body } = noteParts(d.text ?? "");
      const source = d.source ? asUrl(d.source) : null;
      push({
        key: node.id,
        target: at,
        fields: [...field(head, "name"), ...field(body.join(" "), "words"), ...where(d.source)],
        meta: "note",
        thumb: source ? { site: source } : null,
        added: "",
      });
    } else if (node.type === "stack") {
      const d = node.data as StackData;
      const items = d.items ?? [];
      const cover = items[items.length - 1];
      const added = items.reduce((m, i) => (i.added && i.added > m ? i.added : m), "");
      push({ key: node.id, target: at, fields: [...field(d.title, "name"), ...field(d.description, "words")], meta: "stack", thumb: cover ? itemThumb(cover) : null, added });
      for (const item of items) {
        push({
          key: `${node.id}/${item.id}`,
          target: { kind: "item", nodeId: node.id, itemId: item.id },
          fields: itemFields(item, docWords),
          meta: d.title?.trim() ? `in ${d.title.trim()}` : "in a stack",
          thumb: itemThumb(item),
          added: item.added ?? "",
        });
      }
    } else if (node.type === "card") {
      const item = (node.data as CardData).item;
      if (!item) continue;
      push({ key: node.id, target: at, fields: itemFields(item, docWords), meta: KIND_WORD[item.kind], thumb: itemThumb(item), added: item.added ?? "" });
    } else if (node.type === "area") {
      const d = node.data as AreaData;
      push({ key: node.id, target: at, fields: field(d.title, "name"), meta: "area", thumb: null, added: "" });
    }
  }
  for (const edge of edges) {
    const note = (edge.data as LinkData | undefined)?.note;
    push({
      key: `wire:${edge.id}`,
      target: { kind: "wire", wireId: edge.id, from: edge.source, to: edge.target },
      fields: field(note, "name"),
      meta: "wire note",
      thumb: null,
      added: "",
    });
  }
  return out;
}
