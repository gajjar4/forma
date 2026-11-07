// Bringing a document in: a PDF, a Markdown or text file, or any other file.
// In a project folder it is copied into media/ under its own name (made
// unique), so the folder stays readable to a person or an AI; a PDF also
// gets a still of its first page beside it. In the browser it is kept in
// the page. Either way it comes back as a `doc` item, dated today.

import { convertFileSrc } from "@tauri-apps/api/core";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { freeName, stemOf } from "../model/docs";
import { isoDay } from "../model/items";
import { newId } from "../model/operations";
import type { Item } from "../model/types";
import { isPdfFile, pdfStill } from "./pdfStill";

const MEDIA = "media";
const join = (...parts: string[]) => parts.join("/").replace(/\/+/g, "/");

/** What every document carries besides its file: the day, and where it came from when known. */
const fields = (source?: string): Partial<Item> => ({ ...(source?.trim() ? { source: source.trim() } : {}), added: isoDay() });

/** Copies `file` into the project's media/ and returns it as a document. */
export async function importDocToFolder(root: string, file: File, source?: string): Promise<Item> {
  const dir = join(root, MEDIA);
  await mkdir(dir, { recursive: true });
  const name = await freeName(file.name || "document", (n) => exists(join(dir, n)));
  const rel = join(MEDIA, name);
  const [bytes, page] = await Promise.all([file.arrayBuffer(), isPdfFile(file) ? pdfStill(file) : null]);
  // createNew: never written over, even by a file that arrived a moment ago.
  await writeFile(join(root, rel), new Uint8Array(bytes), { createNew: true });
  const item: Item = { id: newId("doc"), kind: "doc", file: rel, src: convertFileSrc(join(root, rel)), ...fields(source) };
  // A file that had to be renamed to fit in keeps the name it came with.
  if (name !== file.name && file.name) item.title = stemOf(file.name);
  if (page?.still) {
    const poster = await freeName(`${stemOf(name)}.jpg`, (n) => exists(join(dir, n)));
    const posterRel = join(MEDIA, poster);
    await writeFile(join(root, posterRel), new Uint8Array(await page.still.arrayBuffer()));
    Object.assign(item, { poster: posterRel, posterSrc: convertFileSrc(join(root, posterRel)), w: page.w, h: page.h });
  }
  return item;
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** A document kept in the page (the browser board): its title is its whole file name, so its kind is known. */
export async function importDocToBrowser(file: File, source?: string): Promise<Item> {
  const [src, page] = await Promise.all([readDataUrl(file), isPdfFile(file) ? pdfStill(file) : null]);
  const item: Item = { id: newId("doc"), kind: "doc", src, title: file.name || "Document", ...fields(source) };
  if (page?.still) {
    const poster = await readDataUrl(page.still);
    Object.assign(item, { poster, posterSrc: poster, w: page.w, h: page.h });
  }
  return item;
}
