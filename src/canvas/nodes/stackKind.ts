import type { Item } from "../../model/types";

export type StackKind = "image" | "video" | "note" | "link" | "live" | "doc" | "mixed";

/** What a stack holds: one kind, or a mix. Empty stacks hold nothing yet. */
export function stackKind(items: Item[]): StackKind | null {
  if (items.length === 0) return null;
  const first = items[0].kind;
  return items.every((i) => i.kind === first) ? first : "mixed";
}

const NOUN: Record<StackKind, [string, string]> = {
  image: ["image", "images"],
  video: ["video", "videos"],
  note: ["note", "notes"],
  link: ["link", "links"],
  live: ["live card", "live cards"],
  doc: ["document", "documents"],
  mixed: ["mixed", "mixed"],
};

/** The count under a stack, in words: "6 images", "1 note", "12 mixed". */
export function countLabel(items: Item[]): string {
  const kind = stackKind(items);
  if (!kind) return "0";
  const [one, many] = NOUN[kind];
  return `${items.length} ${items.length === 1 ? one : many}`;
}
