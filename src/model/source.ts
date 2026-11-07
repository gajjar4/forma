// Where things came from, as the board shows it: the source's own mark on a
// note, on an image when you look closer, and on a stack only when everything
// in it came from the same place.

import { asUrl, hostOf } from "./items";
import type { Item } from "./types";

/**
 * The one place everything in a stack came from, or null when they differ or
 * any item doesn't say. One answer or none: a mixed stack shows no mark.
 */
export function sharedSource(items: Item[]): string | null {
  let first: string | null = null;
  for (const item of items) {
    const url = item.source ? asUrl(item.source) : null;
    if (!url) return null;
    if (!first) first = url;
    else if (hostOf(url) !== hostOf(first)) return null;
  }
  return first;
}
