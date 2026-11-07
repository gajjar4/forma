import type { Board } from "../model/format";
import { isoDay } from "../model/items";
import type { Item } from "../model/types";
import type { Version } from "./keeper";
import { paletteFields } from "./readPalette";

/** Where a board lives. The canvas only talks to this, never to storage directly. */
export interface BoardStore {
  /** Shown in the corner: the project folder's name, or where the board is kept. */
  name: string;
  /** The project folder, when there is one. */
  root?: string;
  load(): Promise<Board>;
  /** Saves soon. Calls close together are merged into one write. */
  save(board: Board): void;
  /**
   * Brings an image, a video or a document into the project and returns it
   * as an item, dated today, with its palette and, when known, where it came
   * from (`source`). A video also gets a still, its `poster`, and so does a
   * PDF (its first page). Any file that isn't a picture or a video is a document.
   */
  importMedia(file: File, source?: string): Promise<Item>;
  /** Called when the board changes outside the app (an AI, an editor). Returns a stop function. */
  watch(onChange: (board: Board) => void): () => void;
  /** Writes what's waiting now, without the usual moment's wait. Resolves once it's kept; rejects if it couldn't be. */
  flush(): Promise<void>;
  /** Earlier versions of the board, the latest first. Only where they're kept (the Mac app). */
  versions?(): Promise<Version[]>;
  /**
   * Brings back an earlier version (by its name from `versions`). The board
   * as it is now is kept as a version first, and the one brought back arrives
   * like a change from outside, so ⌘Z takes it back.
   */
  restore?(name: string): Promise<void>;
}

/** Natural size of an image file, for keeping its proportions on the board. */
export async function imageSize(file: Blob): Promise<{ w: number; h: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { w: 1, h: 1 };
  }
}

export const titleFromName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

/**
 * What every newly imported image or video carries besides its file: the day,
 * its palette (from `picture`, the image or a video's still), and where it
 * came from.
 */
export async function newImageFields(picture: Blob | null, source?: string): Promise<Partial<Item>> {
  const palette = picture ? await paletteFields(picture) : {};
  return { ...palette, ...(source?.trim() ? { source: source.trim() } : {}), added: isoDay() };
}
