// Documents kept with the research: a PDF, a Markdown or text file, or any
// other file (a deck, a Figma or Sketch file, a zip). What each one is, what
// it is called, and the name it is kept under. Pure, so the board, the
// stores and the file format agree.

import type { Item } from "./types";

/** How a document is shown: its first page, its first lines, or a plain sheet with its name. */
export type DocType = "pdf" | "text" | "file";

const PICTURE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif|svg)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const TEXT_EXT = new Set(["md", "markdown", "mdown", "txt", "text"]);
const MARKDOWN_EXT = new Set(["md", "markdown", "mdown"]);

/** A picture or a video, by its type or, when the type is missing, its name. Everything else is a document. */
export function isPictureOrVideo(file: { name: string; type: string }) {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return true;
  return PICTURE_EXT.test(file.name) || VIDEO_EXT.test(file.name);
}

export const isDocFile = (file: { name: string; type: string }) => !isPictureOrVideo(file);

/** The last part of a path or an address, decoded: "media/Brief%202.pdf" is "Brief 2.pdf". */
export function baseName(path: string) {
  const bare = path.split(/[?#]/)[0];
  let decoded = bare;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    // Not encoded after all.
  }
  return decoded.split("/").filter(Boolean).pop() ?? "";
}

/** A name's extension, lower case and without the dot: "" when it has none. */
export function extOf(name: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** A name without its extension. */
export const stemOf = (name: string) => (extOf(name) ? name.slice(0, name.lastIndexOf(".")) : name);

/**
 * The name a document's file goes by: "Interview notes.md". One kept in the
 * page (the browser board) has no file, only its title.
 */
export function docFileName(item: Item) {
  if (item.file) return baseName(item.file) || "Document";
  if (item.src && !item.src.startsWith("data:")) return baseName(item.src) || "Document";
  return item.title?.trim() || "Document";
}

/** A document's extension, from its file. */
export const docExt = (item: Item) => extOf(docFileName(item));

/** What a document is called: its title, or its file's name, either without its extension. */
export function docTitle(item: Item) {
  const title = item.title?.trim();
  const ext = docExt(item);
  if (title) return ext && extOf(title) === ext ? stemOf(title) : title;
  return stemOf(docFileName(item)) || "Document";
}

export function docType(item: Item): DocType {
  const ext = docExt(item);
  if (ext === "pdf") return "pdf";
  return TEXT_EXT.has(ext) ? "text" : "file";
}

export const isMarkdown = (item: Item) => MARKDOWN_EXT.has(docExt(item));

/** A PDF whose first page has been kept as a still: shown as that picture. */
export const docPicture = (item: Item) => (item.kind === "doc" && docType(item) === "pdf" ? item.posterSrc : undefined);

/** The plain sheet a document sits as, the note's paper a little taller. */
export const DOC_SHAPE = { w: 152, h: 200 };
/** How far a PDF's own page shape may lean before it is held in: a long receipt, a wide banner. */
const ASPECT_MIN = 0.5;
const ASPECT_MAX = 2;

/** A document's proportions: a PDF's page when it is known, the sheet otherwise. */
export function docShape(item: Item) {
  if (!(docPicture(item) && item.w && item.w > 0 && item.h && item.h > 0)) return DOC_SHAPE;
  const a = Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, item.w / item.h));
  return { w: Math.round(1000 * a), h: 1000 };
}

/**
 * A file name that is safe to keep in media/: no folders, no hidden dot at
 * the start (the app can't see hidden files), no characters macOS or a
 * board's JSON would trip on.
 */
export function safeFileName(name: string) {
  const clean = name
    .replace(/[/\\:\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  const ext = extOf(clean);
  const stem = stemOf(clean).trim();
  if (!stem) return ext ? `document.${ext}` : "document";
  // Keep it well under the file system's 255 bytes.
  const short = stem.length > 120 ? stem.slice(0, 120).trim() : stem;
  return ext ? `${short}.${ext}` : short;
}

/** The names to try, in turn, until one is free: "Brief.pdf", "Brief 2.pdf", "Brief 3.pdf"... */
export function* namesFor(name: string) {
  const safe = safeFileName(name);
  yield safe;
  const ext = extOf(safe);
  const stem = stemOf(safe);
  for (let n = 2; ; n++) yield ext ? `${stem} ${n}.${ext}` : `${stem} ${n}`;
}

/**
 * The first of `namesFor(name)` that isn't taken (`taken` says whether a name
 * is). Past a few hundred tries it adds the time instead, so a file already
 * there is never written over.
 */
export async function freeName(name: string, taken: (name: string) => Promise<boolean>, now = Date.now()) {
  let tries = 0;
  for (const candidate of namesFor(name)) {
    if (!(await taken(candidate))) return candidate;
    if (++tries >= 300) break;
  }
  const safe = safeFileName(name);
  const ext = extOf(safe);
  const stamped = `${stemOf(safe)} ${now.toString(36)}`;
  return ext ? `${stamped}.${ext}` : stamped;
}

/** Kinds of file that run something when opened (an app, a script, an installer): never opened from a board. */
const RUNS = new Set(["app", "command", "sh", "zsh", "bash", "tool", "terminal", "workflow", "action", "pkg", "mpkg", "scpt", "applescript", "jar", "exe", "bat", "cmd", "msi", "py", "rb", "pl", "js", "webloc", "inetloc", "fileloc", "url"]);

/**
 * Where a document's file is on this Mac, to open it with its own app. Only a
 * file inside the board's folder, and never one that would run something:
 * a board can come from anyone, so a click on it should only ever open a file.
 */
export function docPath(root: string | undefined, item: Item): string | null {
  const file = item.file;
  if (!root || !file || file.startsWith("/") || file.split(/[/\\]/).some((p) => p === "..")) return null;
  if (RUNS.has(docExt(item))) return null;
  return `${root.replace(/\/+$/, "")}/${file.replace(/^\.?\/+/, "")}`;
}
