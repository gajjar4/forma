import { describe, expect, it } from "vitest";
import { parseBoard, toBoardFile } from "./format";
import type { Item } from "./types";

const fileWith = (item: object) => JSON.stringify({ forma: 1, nodes: [{ id: "c", type: "card", x: 0, y: 0, item }], wires: [] });
const itemOf = (text: string) => (parseBoard(text, (f) => `shown:${f}`)!.nodes[0]?.data as { item?: Item } | undefined)?.item;

describe("documents in board.json", () => {
  it("round-trips a document with its title, note, source and day", () => {
    const stored = {
      id: "d1",
      kind: "doc",
      file: "media/Brief.pdf",
      title: "Brief",
      note: "What they sent first.",
      source: "https://example.com/brief",
      added: "2026-11-03",
    };
    const item = itemOf(fileWith(stored))!;
    expect(item.src).toBe("shown:media/Brief.pdf");
    const back = toBoardFile({ nodes: [{ id: "c", type: "card", position: { x: 0, y: 0 }, data: { item } }], edges: [] });
    expect(back.nodes[0]).toEqual({ id: "c", x: 0, y: 0, type: "card", item: stored });
  });

  it("keeps a PDF's still and page size, and shows the still through the resolver", () => {
    const stored = { id: "d2", kind: "doc", file: "media/Deck.pdf", poster: "media/Deck.jpg", w: 960, h: 540 };
    const item = itemOf(fileWith(stored))!;
    expect(item.posterSrc).toBe("shown:media/Deck.jpg");
    const back = toBoardFile({ nodes: [{ id: "c", type: "card", position: { x: 0, y: 0 }, data: { item } }], edges: [] });
    expect(back.nodes[0]).toMatchObject({ item: stored });
    expect(JSON.stringify(back)).not.toContain("shown:");
  });

  it("files documents in stacks like anything else", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [{ id: "s", type: "stack", x: 0, y: 0, title: "Docs", items: [{ id: "a", kind: "doc", file: "media/Notes.md" }, { id: "b", kind: "doc" }] }],
      wires: [],
    });
    const items = (parseBoard(text)!.nodes[0].data as { items: Item[] }).items;
    // One without a file is a broken entry, and is skipped.
    expect(items.map((i) => i.id)).toEqual(["a"]);
  });

  it("drops a badly formed note or day and keeps the document", () => {
    const item = itemOf(fileWith({ id: "d3", kind: "doc", file: "media/a.txt", note: 4, added: "soon" }))!;
    expect(item).toEqual({ id: "d3", kind: "doc", file: "media/a.txt", src: "shown:media/a.txt" });
  });
});
