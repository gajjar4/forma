// A note being written, as fields: its heading, then one per paragraph of the
// rest. Each field can then look exactly like the text it stands in for. The
// note itself stays one string, paragraphs split by a blank line (FORMAT.md).
// Pure, so the board and an opened stack edit notes the same way.

import { noteParts } from "../../model/items";

/** The heading first, then each paragraph. Always at least the heading. */
export type Fields = string[];

/** Where the caret goes: which field, and how far into it. */
export type Caret = { field: number; at: number };

/** Fields after a key, and where the caret lands. */
export type Step = { fields: Fields; caret: Caret };

/** A blank line, however many there are and whatever spaces sit on them. */
const BREAK = /\n\s*\n/g;

export const hasBreak = (value: string) => new RegExp(BREAK.source).test(value);

export function toFields(text: string): Fields {
  const { head, body } = noteParts(text);
  return [head, ...body];
}

/**
 * The note's text. Empty paragraphs drop out; with no heading, the first
 * paragraph becomes it, as it would when the file is read back.
 */
export function toText(fields: Fields): string {
  return fields
    .map((f) => f.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** True when the fields say something other than `text` does. */
export const changed = (fields: Fields, text: string) => toText(fields) !== toText(toFields(text));

/**
 * Field `i` cut into one field per paragraph wherever it holds a blank line
 * (a paste, Enter), with the caret kept where it was in the text.
 */
export function breakApart(fields: Fields, i: number, at: number): Step {
  const value = fields[i] ?? "";
  const pieces: string[] = [];
  let caret: Caret | null = null;
  let last = 0;
  for (const m of value.matchAll(BREAK)) {
    const end = m.index + m[0].length;
    pieces.push(value.slice(last, m.index));
    if (!caret && at <= m.index) caret = { field: i + pieces.length - 1, at: at - last };
    else if (!caret && at < end) caret = { field: i + pieces.length, at: 0 };
    last = end;
  }
  pieces.push(value.slice(last));
  caret ??= { field: i + pieces.length - 1, at: Math.max(0, at - last) };
  return { fields: [...fields.slice(0, i), ...pieces, ...fields.slice(i + 1)], caret };
}

/** `text` typed over the selection `start`..`end` of field `i`. */
export function insert(fields: Fields, i: number, start: number, end: number, text: string): Step {
  const value = fields[i] ?? "";
  const next = [...fields];
  next[i] = value.slice(0, start) + text + value.slice(end);
  return breakApart(next, i, start + text.length);
}

/**
 * Enter starts a new paragraph at the caret. In the heading with nothing
 * after the caret it goes on to the start of the body, since a heading is
 * one paragraph.
 */
export function enter(fields: Fields, i: number, start: number, end: number): Step {
  const value = fields[i] ?? "";
  if (i === 0 && fields.length > 1 && !value.slice(end).trim()) {
    return { fields: [value.slice(0, start), ...fields.slice(1)], caret: { field: 1, at: 0 } };
  }
  return insert(fields, i, start, end, "\n\n");
}

/** Backspace at the very start of field `i`: it joins the end of the one before. */
export function joinBack(fields: Fields, i: number): Step | null {
  if (i <= 0 || i >= fields.length) return null;
  const at = fields[i - 1].length;
  const next = [...fields];
  next.splice(i - 1, 2, fields[i - 1] + fields[i]);
  return { fields: next, caret: { field: i - 1, at } };
}

/** Delete at the very end of field `i`: the next one joins it. */
export function joinForward(fields: Fields, i: number): Step | null {
  if (i < 0 || i >= fields.length - 1) return null;
  const step = joinBack(fields, i + 1);
  return step && { ...step, caret: { field: i, at: fields[i].length } };
}
