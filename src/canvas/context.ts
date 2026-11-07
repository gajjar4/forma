import { createContext, useContext } from "react";
import type { Item } from "../model/types";

/** Canvas-wide state and actions the nodes and wires use. */
export type CanvasUi = {
  /** The stack or card the dragged thing would join if dropped now. */
  dropTargetId: string | null;
  /** Remember the board before an edit, so it can be undone. */
  commit: () => void;
  /** The card open big, hidden on the board meanwhile. */
  liveId: string | null;
  /** Change one item wherever it is (a loose card or in a stack), as one undoable edit. */
  updateItem: (itemId: string, patch: Partial<Item>) => void;
  /** The board's folder, in the Mac app: where a document's file is, to open it in its own app. */
  root?: string;
};

export const CanvasUiContext = createContext<CanvasUi>({
  dropTargetId: null,
  commit: () => {},
  liveId: null,
  updateItem: () => {},
});

export const useCanvasUi = () => useContext(CanvasUiContext);
