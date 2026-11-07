import { motion, type Transition } from "motion/react";
import { useCanvasUi } from "../canvas/context";
import { FileFace, TextFace } from "../canvas/nodes/DocFace";
import { docPath, docType } from "../model/docs";
import type { Item } from "../model/types";
import { PdfSheet } from "./PdfSheet";
import type { Size } from "./pdfPages";

/**
 * How wide a Markdown or text document comes up: a comfortable line to read.
 * Its face is designed at this width (docs.css), so here it reads at the
 * tokens' own sizes, the body at 14px.
 */
export const DOC_READ_WIDTH = 480;

type Props = {
  item: Item;
  /** The lifted sheet's box, in px. */
  box: Size;
  /** It has landed (and stays so on the way home). */
  landed: boolean;
  leaving: boolean;
};

/**
 * A document lifted to read. Markdown and text are their face grown, line for
 * line, then scroll; the rest of a long file comes in once it has landed. A
 * PDF is its still, then its own pages drawn under it (PdfSheet). Any other
 * file is its paper face, big.
 */
export function DocSheet({ item, box, landed, leaving }: Props) {
  const type = docType(item);
  if (type === "text") return <TextFace item={item} read whole={landed} />;
  if (type === "pdf" && item.src) return <PdfSheet item={item} src={item.src} box={box} landed={landed} leaving={leaving} />;
  return <FileFace item={item} />;
}

type Actions = { item: Item; /** Below the sheet's middle, in px. */ below: number; shown: boolean; fade: Transition };

/**
 * One quiet action under a lifted document: open it in its own app. A PDF
 * opens in Preview; anything else in whatever the Mac opens it with. Only in
 * the Mac app, and only for a file inside the board.
 */
export function DocActions({ item, below, shown, fade }: Actions) {
  const { root } = useCanvasUi();
  const path = "__TAURI_INTERNALS__" in window ? docPath(root, item) : null;
  if (!path) return null;
  const pdf = docType(item) === "pdf";
  const open = async () => {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path, pdf ? "Preview" : undefined).catch(() => openPath(path).catch(() => {}));
  };
  return (
    <motion.div
      className="doc-actions"
      style={{ top: `calc(50% + ${Math.round(below)}px)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={fade}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="ft-pill" onClick={() => void open()}>
        {pdf ? "Open in Preview" : "Open"}
      </button>
    </motion.div>
  );
}
