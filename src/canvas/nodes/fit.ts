import { itemShape } from "../../model/items";
import type { Item } from "../../model/types";

/** Size of an item drawn inside a square box, keeping its proportions. */
export function fitInBox(item: Item, box: number) {
  const { w, h } = itemShape(item);
  const s = box / Math.max(w, h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}
