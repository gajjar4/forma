import { useEffect, useEffectEvent, useRef, useState } from "react";
import { DocFace, FileFace } from "../canvas/nodes/DocFace";
import { docPicture } from "../model/docs";
import type { Item } from "../model/types";
import { drawPage, openPdf, pageSize, type PDFDocumentProxy } from "./pdf";
import { canvasPixels, pageBoxes, type PageBox, type Size } from "./pdfPages";

type Props = {
  item: Item;
  src: string;
  /** The lifted sheet's box, in px: where the still is. */
  box: Size;
  /** It has landed: only then is anything drawn. */
  landed: boolean;
  /** On its way home: nothing more is drawn, and the still shows again. */
  leaving: boolean;
};

/** How far past the window a page is drawn ahead, and kept, as you scroll. */
const NEAR = "150% 0px";

/**
 * A PDF, read big: its pages drawn by us as one scrolling column of white
 * paper. The still flies up as it is; once it has landed the first page is
 * drawn over it at the same box and the screen's own sharpness and fades in,
 * so nothing moves. The rest are drawn as they come near. Put back, the pages
 * fade off the still and it flies home. If the PDF can't be read, the still
 * simply stays.
 */
export function PdfSheet({ item, src, box, landed, leaving }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!landed) return;
    let live = true;
    let opened: PDFDocumentProxy | null = null;
    void (async () => {
      const d = await openPdf(src);
      if (!live) return void d.loadingTask.destroy();
      opened = d;
      // The first page straight away, then every page's shape for the column below it.
      const first = pageSize(await d.getPage(1));
      if (!live) return;
      setDoc(d);
      setSizes([first]);
      const rest = await Promise.all(Array.from({ length: d.numPages - 1 }, (_, i) => d.getPage(i + 2).then(pageSize)));
      if (live) setSizes([first, ...rest]);
    })().catch(() => {});
    return () => {
      live = false;
      void opened?.loadingTask.destroy();
    };
  }, [landed, src]);

  const boxes = pageBoxes(box, sizes);
  const shown = ready && !leaving;
  return (
    <div className="doc-pdf">
      {/* Under the pages, so it stays painted and is there the moment they go. */}
      <div className="doc-pdf-still">{docPicture(item) ? <DocFace item={item} /> : <FileFace item={item} />}</div>
      <div className="doc-pages" data-ready={ready || undefined} data-shown={shown || undefined}>
        {doc &&
          boxes.map((b, i) => (
            <Page key={i} doc={doc} n={i + 1} box={b} leaving={leaving} onDrawn={i === 0 ? () => setReady(true) : undefined} />
          ))}
      </div>
    </div>
  );
}

type PageProps = { doc: PDFDocumentProxy; n: number; box: PageBox; leaving: boolean; onDrawn?: () => void };

/**
 * One page: white paper of its own shape, drawn when it comes near and let go
 * of when it is far, so a long PDF never holds more than a few screens of
 * pages. The first is always drawn.
 */
function Page({ doc, n, box, leaving, onDrawn }: PageProps) {
  const slot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const first = n === 1;
  const [near, setNear] = useState(first);
  const [drawn, setDrawn] = useState(false);

  // Nothing is drawn or let go of on the way home: the still is showing.
  const onSeen = useEffectEvent((seen: boolean) => {
    if (leaving) return;
    setNear(seen);
    if (seen) return;
    setDrawn(false);
    const c = canvas.current;
    if (c) c.width = c.height = 0;
  });
  const done = useEffectEvent(() => {
    setDrawn(true);
    onDrawn?.();
  });

  useEffect(() => {
    const el = slot.current;
    const root = el?.closest(".doc-pages");
    if (first || !el || !root) return;
    const io = new IntersectionObserver(([e]) => onSeen(e.isIntersecting), { root, rootMargin: NEAR });
    io.observe(el);
    return () => io.disconnect();
  }, [first]);

  const { drawW, drawH } = box;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !near || drawn || leaving || !(drawW > 0)) return;
    let live = true;
    let task: ReturnType<typeof drawPage> | null = null;
    void (async () => {
      const page = await doc.getPage(n);
      if (!live) return;
      task = drawPage(page, c, canvasPixels({ h: drawH, drawW, drawH, left: 0 }, window.devicePixelRatio || 1));
      await task.promise;
      // Finished: nothing left to cancel.
      task = null;
      if (live) done();
    })().catch(() => {});
    return () => {
      live = false;
      task?.cancel();
    };
  }, [doc, n, near, drawn, leaving, drawW, drawH]);

  return (
    <div ref={slot} className="doc-page" style={{ height: box.h }}>
      <canvas ref={canvas} data-drawn={drawn || undefined} style={{ left: box.left, width: drawW, height: drawH }} />
    </div>
  );
}
