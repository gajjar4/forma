import { useDeferredValue } from "react";
import { Markdown } from "../../focus/Markdown";
import { docExt, docFileName, docPicture, docTitle, docType, isMarkdown } from "../../model/docs";
import { faceText } from "../../model/markdown";
import type { Item } from "../../model/types";
import { useDocText } from "../docText";

/**
 * A document as a sheet of paper. A PDF shows its first page, kept as a still
 * when it came in. Markdown and text are the top of the page they are when
 * lifted, cut off. Anything else is a plain sheet: its kind in small mono
 * capitals and its name. Static: the text is read once (docText), never while
 * the board draws.
 */
export function DocFace({ item }: { item: Item }) {
  const picture = docPicture(item);
  if (picture) {
    return (
      <span className="face face-doc" data-doc="pdf">
        <img src={picture} alt={docTitle(item)} draggable={false} />
      </span>
    );
  }
  return docType(item) === "text" ? <TextFace item={item} /> : <FileFace item={item} />;
}

type TextProps = {
  item: Item;
  /** Lifted to read: it scrolls, and its links open. */
  read?: boolean;
  /** The whole file instead of a face's worth. Set once a lifted sheet has landed. */
  whole?: boolean;
};

/**
 * Markdown or text as one sheet of paper, laid out in container units
 * (docs.css): on the board, in a pile, in an opened stack and lifted it is
 * the same page line for line, so lifting it only scales it. A face reads
 * only the start of the file; a lifted sheet adds the rest after it lands,
 * below the fold and without holding up the frame.
 */
export function TextFace({ item, read = false, whole = false }: TextProps) {
  const text = useDocText(item);
  const all = useDeferredValue(whole);
  const shown = text === undefined ? "" : all ? text : faceText(text);
  return (
    <span className={read ? "face face-doc face-read" : "face face-doc"} data-doc="text">
      <span className="face-in">
        <span className="face-doc-name">{docFileName(item)}</span>
        {shown && (isMarkdown(item) ? <Markdown text={shown} live={read} /> : <span className="doc-text">{shown}</span>)}
      </span>
    </span>
  );
}

/** A file Forma doesn't read (a deck, a Figma file, a zip, a PDF without a still): what it is, and its name. */
export function FileFace({ item }: { item: Item }) {
  return (
    <span className="face face-doc" data-doc="file">
      <span className="face-in">
        <span className="face-doc-ext">{docExt(item) || "file"}</span>
        <span className="face-doc-title">{docTitle(item)}</span>
      </span>
    </span>
  );
}
