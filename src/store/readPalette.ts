// Reading an image's colours in the app: decode it, shrink it onto a tiny
// canvas, and cluster the pixels (src/model/palette.ts).
//
// The pixels come from a fetched blob rather than the <img> on screen, so the
// canvas is never tainted: project files come through Tauri's asset protocol,
// which answers with Access-Control-Allow-Origin set to the app's own origin,
// and the browser build shows data URLs and same-origin files.

import { paletteOf } from "../model/palette";

/** The picture is shrunk to this square first; a palette needs no more. */
const SIDE = 64;

export async function paletteOfBlob(blob: Blob): Promise<string[]> {
  // The decode (and, where supported, the shrink) happens off the main thread.
  const bitmap = await createImageBitmap(blob, { resizeWidth: SIDE, resizeHeight: SIDE, resizeQuality: "medium" });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, SIDE, SIDE);
    return paletteOf(ctx.getImageData(0, 0, SIDE, SIDE).data);
  } finally {
    bitmap.close();
  }
}

/** The palette of whatever an image's `src` shows, or null when it can't be read (a web image that won't share its pixels). */
export async function paletteOfSrc(src: string): Promise<string[] | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    return await paletteOfBlob(await res.blob());
  } catch {
    return null;
  }
}

/** For a new image: its palette as item fields, or nothing when it can't be read. */
export async function paletteFields(file: Blob): Promise<{ palette?: string[] }> {
  try {
    const palette = await paletteOfBlob(file);
    return palette.length ? { palette } : {};
  } catch {
    return {};
  }
}
