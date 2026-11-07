// A PDF's first page as a picture, made once when it is brought in. WebKit
// (the Mac app's engine) draws a PDF given to an <img> as its first page, so
// no PDF library is needed: the page is drawn onto a canvas and kept as a
// JPEG beside the file, the board shows that still, and the PDF itself is only
// opened when you open it. Where the engine can't (Chromium), there is no
// still and the document shows as a plain sheet with its name.

import type { VideoStill } from "./videoStill";

/** The longest side of the saved still, in pixels: sharp when lifted, small on disk. */
const MAX_SIDE = 1400;

export const isPdfFile = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

/** The first page's size in points (`w`, `h`) and a still of it. */
export async function pdfStill(file: Blob): Promise<VideoStill> {
  const url = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No picture of this PDF"));
      img.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return { w: 1, h: 1, still: null };
    // A page is drawn as its outlines, so it can be drawn bigger than its points without going soft.
    const scale = MAX_SIDE / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { w, h, still: null };
    // A page with no background of its own is white paper, never black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const still = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return { w, h, still };
  } catch {
    return { w: 1, h: 1, still: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}
