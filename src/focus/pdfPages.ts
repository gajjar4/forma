// Where a lifted PDF's pages go: one column of white pages, the sheet's
// width, a small gap between them. The first page is drawn exactly where its
// still is (object-fit: cover from the top, as the face shows it), so the
// still can give way to the drawn page without anything moving. Pure, so it
// can be tested.

export type Size = { w: number; h: number };

/** One page in the column: how tall its slot is, and where the drawing sits in it. */
export type PageBox = { h: number; drawW: number; drawH: number; left: number };

/** Space between two pages, in px. */
export const PAGE_GAP = 8;

/**
 * The biggest canvas drawn for one page, in device pixels: WebKit refuses a
 * canvas much past 4096 squared, and a page that size is sharp at any size
 * the window allows.
 */
export const MOST_PIXELS = 4096 * 4096;

/**
 * Every page at the sheet's `width`, the first covering the still's `box`.
 * `pages` are the pages' own sizes (any unit, only their shape counts).
 */
export function pageBoxes(box: Size, pages: Size[]): PageBox[] {
  return pages.map((p, i) => {
    if (!(p.w > 0 && p.h > 0)) return { h: 0, drawW: 0, drawH: 0, left: 0 };
    // The first page covers the still's box like the still does: a page
    // taller than the box runs on below it, a wide one is cut at its sides.
    const scale = i === 0 ? Math.max(box.w / p.w, box.h / p.h) : box.w / p.w;
    const drawW = p.w * scale;
    const drawH = p.h * scale;
    return { h: drawH, drawW, drawH, left: (box.w - drawW) / 2 };
  });
}

/** A page's canvas in device pixels at `dpr`, held under MOST_PIXELS. */
export function canvasPixels(page: PageBox, dpr: number): Size {
  const want = page.drawW * page.drawH * dpr * dpr;
  const k = want > MOST_PIXELS ? Math.sqrt(MOST_PIXELS / want) : 1;
  return { w: Math.max(1, Math.round(page.drawW * dpr * k)), h: Math.max(1, Math.round(page.drawH * dpr * k)) };
}
