// Reading a PDF ourselves with pdf.js, so a lifted PDF is drawn as the same
// white page its still shows, with no system viewer and its own grey and
// margins swapped in. pdf.js is only loaded the first time a PDF is opened.
// It parses in one worker and draws in another (OffscreenCanvas), so a page
// being drawn never holds up a frame; where the drawing worker can't start,
// pdf.js draws on the page in short slices instead.

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import rendererSrc from "pdfjs-dist/build/pdf.renderer.min.mjs?url";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Size } from "./pdfPages";

export type { PDFDocumentProxy, PDFPageProxy };

// The fonts a PDF may name without carrying them, and the decoders for JPEG
// 2000, JBIG2 and colour profiles. Each is its own small file, fetched only
// when a PDF asks for it.
const FILES = {
  ...import.meta.glob("/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}", { query: "?url", import: "default" }),
  ...import.meta.glob("/node_modules/pdfjs-dist/wasm/{openjpeg,jbig2,qcms_bg}.wasm", { query: "?url", import: "default" }),
  ...import.meta.glob("/node_modules/pdfjs-dist/wasm/{openjpeg,jbig2}_nowasm_fallback.js", { query: "?url", import: "default" }),
} as Record<string, () => Promise<string>>;

const FOLDER: Record<string, string> = { standardFontDataUrl: "standard_fonts", wasmUrl: "wasm" };

/** Hands pdf.js the files above by name, from wherever the build put them. */
class Files {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const url = FILES[`/node_modules/pdfjs-dist/${FOLDER[kind]}/${filename}`];
    if (!url) throw new Error(`No ${filename}`);
    const res = await fetch(await url());
    if (!res.ok) throw new Error(`No ${filename}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

let lib: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjs() {
  if (!lib) {
    lib = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = workerSrc;
      m.GlobalWorkerOptions.rendererSrc = rendererSrc;
      return m;
    });
    // A failed load can be tried again with the next PDF.
    lib.catch(() => (lib = null));
  }
  return lib;
}

/** Opens a PDF from its address: a file on this Mac (asset:), the dev server, or a data: address. */
export async function openPdf(src: string): Promise<PDFDocumentProxy> {
  const [{ getDocument }, bytes] = await Promise.all([
    pdfjs(),
    fetch(src).then((res) => {
      if (!res.ok) throw new Error("No PDF");
      return res.arrayBuffer();
    }),
  ]);
  return getDocument({
    data: new Uint8Array(bytes),
    BinaryDataFactory: Files,
    // Only names: Files resolves them. They must be set for pdf.js to ask.
    standardFontDataUrl: "standard_fonts/",
    wasmUrl: "wasm/",
  }).promise;
}

/** A page's own size, in CSS px at 100%: its shape, turned as it is meant to be read. */
export function pageSize(page: PDFPageProxy): Size {
  const v = page.getViewport({ scale: 1 });
  return { w: v.width, h: v.height };
}

/** Draws `page` onto `canvas`, filling `pixels` (device pixels). Cancel it to stop. */
export function drawPage(page: PDFPageProxy, canvas: HTMLCanvasElement, pixels: Size): RenderTask {
  canvas.width = pixels.w;
  canvas.height = pixels.h;
  const viewport = page.getViewport({ scale: pixels.w / pageSize(page).w });
  return page.render({ canvas, viewport });
}
