import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { Item } from "../model/types";
import { indexBoard, search } from "./search";

const card = (id: string, item: Item): Node => ({ id, type: "card", position: { x: 0, y: 0 }, data: { item } });
const words: Record<string, string> = { "/m/Interview notes.md": "# Interview notes\n\nThey answer from their phone." };

const board: Node[] = [
  card("c-notes", { id: "d-notes", kind: "doc", file: "media/Interview notes.md", src: "/m/Interview notes.md" }),
  card("c-brief", { id: "d-brief", kind: "doc", file: "media/Brief.pdf", src: "/m/Brief.pdf", posterSrc: "/m/Brief.jpg", title: "Northwind brief" }),
  { id: "s", type: "stack", position: { x: 0, y: 0 }, data: { title: "Files", items: [{ id: "d-deck", kind: "doc", file: "media/Pitch.key", src: "/m/Pitch.key" }] } },
];

describe("finding documents", () => {
  const index = indexBoard(board, [], (src) => (src ? words[src] : undefined));

  it("by their title or file name", () => {
    expect(search(index, "brief")[0]).toMatchObject({ key: "c-brief", meta: "document", thumb: { still: "/m/Brief.jpg" } });
    expect(search(index, "pitch")[0]).toMatchObject({ key: "s/d-deck", meta: "in Files" });
    expect(search(index, "brief.pdf")[0]?.key).toBe("c-brief");
  });

  it("by the words of a Markdown or text file, once they have been read", () => {
    expect(search(index, "phone")[0]?.key).toBe("c-notes");
    expect(search(indexBoard(board, []), "phone")).toEqual([]);
  });
});
