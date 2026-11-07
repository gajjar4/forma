import { describe, expect, it } from "vitest";
import { parseBoard, serialize, toBoardFile } from "./format";
import { sampleEdges, sampleNodes } from "./sample";

describe("board.json", () => {
  it("round-trips the sample board", () => {
    const text = serialize({ nodes: sampleNodes, edges: sampleEdges });
    const back = parseBoard(text)!;
    expect(back.nodes.map((n) => [n.id, n.type])).toEqual(sampleNodes.map((n) => [n.id, n.type]));
    expect(back.edges.map((e) => [e.source, e.target])).toEqual(sampleEdges.map((e) => [e.source, e.target]));
    expect(serialize(back)).toBe(text);
  });

  it("stores project files by path and shows them through the resolver", () => {
    const board = {
      nodes: [
        {
          id: "c",
          type: "card",
          position: { x: 1.234, y: 5 },
          data: { item: { id: "i", kind: "image" as const, file: "media/a.jpg", src: "asset://x/media/a.jpg" } },
        },
      ],
      edges: [],
    };
    const file = toBoardFile(board);
    expect(file.nodes[0]).toEqual({ id: "c", x: 1.2, y: 5, type: "card", item: { id: "i", kind: "image", file: "media/a.jpg" } });
    const back = parseBoard(JSON.stringify(file), (f) => `shown:${f}`)!;
    expect((back.nodes[0].data as { item: { src: string } }).item.src).toBe("shown:media/a.jpg");
  });

  it("writes wire notes only when there is one", () => {
    const file = toBoardFile({ nodes: sampleNodes, edges: sampleEdges });
    expect(file.wires.find((w) => w.id === "e1")).toEqual({ id: "e1", from: "project", to: "note-founders" });
    expect(file.wires.find((w) => w.id === "e3")?.note).toBe("They like blue and white");
  });

  it("opens a hand-edited file with a broken entry, minus that entry", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [{ id: "n", type: "note", x: 0, y: 0, text: "hi" }, { type: "note" }, null],
      wires: [{ id: "w", from: "n", to: "missing" }],
    });
    const board = parseBoard(text)!;
    expect(board.nodes).toHaveLength(1);
    expect(board.edges).toHaveLength(0);
  });

  it("round-trips notes and links, in stacks and on cards", () => {
    const board = {
      nodes: [
        {
          id: "s",
          type: "stack",
          position: { x: 0, y: 0 },
          data: {
            title: "Mixed",
            items: [
              { id: "i", kind: "image" as const, file: "media/a.jpg", src: "shown:media/a.jpg", w: 300, h: 200 },
              { id: "n", kind: "note" as const, text: "Founders call\n\nCalm." },
              { id: "l", kind: "link" as const, url: "https://are.na/", title: "Are.na" },
            ],
          },
        },
        { id: "c", type: "card", position: { x: 10, y: 0 }, data: { item: { id: "l2", kind: "link" as const, url: "https://linear.app/" } } },
      ],
      edges: [],
    };
    const file = toBoardFile(board);
    expect(file.nodes[0]).toMatchObject({
      items: [
        { id: "i", kind: "image", file: "media/a.jpg", w: 300, h: 200 },
        { id: "n", kind: "note", text: "Founders call\n\nCalm." },
        { id: "l", kind: "link", url: "https://are.na/", title: "Are.na" },
      ],
    });
    expect(file.nodes[1]).toEqual({ id: "c", x: 10, y: 0, type: "card", item: { id: "l2", kind: "link", url: "https://linear.app/" } });
    const text = JSON.stringify(file);
    const back = parseBoard(text, (f) => `shown:${f}`)!;
    expect(back.nodes).toEqual(board.nodes);
    expect(JSON.stringify(toBoardFile(back))).toBe(text);
  });

  it("skips items that are broken for their kind, and reads a card holding a note as a note", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [
        {
          id: "s",
          type: "stack",
          x: 0,
          y: 0,
          title: "S",
          items: [{ id: "a", kind: "link" }, { id: "b", kind: "video" }, { id: "c", kind: "note" }],
        },
        { id: "k", type: "card", x: 0, y: 0, item: { id: "n", kind: "note", text: "hi" } },
      ],
      wires: [],
    });
    const board = parseBoard(text)!;
    expect((board.nodes[0].data as { items: unknown[] }).items).toEqual([{ id: "c", kind: "note", text: "" }]);
    expect(board.nodes[1]).toMatchObject({ id: "k", type: "note", data: { text: "hi" } });
  });

  it("round-trips live cards, on a card and in a stack", () => {
    const board = {
      nodes: [
        {
          id: "c",
          type: "card",
          position: { x: 0, y: 0 },
          data: {
            item: { id: "l", kind: "live" as const, file: "components/stack-fan.html", src: "shown:components/stack-fan.html", title: "Stack fan", w: 640, h: 400 },
          },
        },
        {
          id: "s",
          type: "stack",
          position: { x: 400, y: 0 },
          data: { title: "Prototypes", items: [{ id: "w", kind: "live" as const, src: "/live/hello.html", title: "Hello" }] },
        },
      ],
      edges: [],
    };
    const file = toBoardFile(board);
    expect(file.nodes[0]).toEqual({
      id: "c",
      x: 0,
      y: 0,
      type: "card",
      item: { id: "l", kind: "live", file: "components/stack-fan.html", title: "Stack fan", w: 640, h: 400 },
    });
    expect(file.nodes[1]).toMatchObject({ items: [{ id: "w", kind: "live", src: "/live/hello.html", title: "Hello" }] });
    const text = JSON.stringify(file);
    const back = parseBoard(text, (f) => `shown:${f}`)!;
    expect(back.nodes).toEqual(board.nodes);
    expect(JSON.stringify(toBoardFile(back))).toBe(text);
  });

  it("skips a live card with neither a file nor a src", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [
        { id: "c", type: "card", x: 0, y: 0, item: { id: "l", kind: "live", title: "Nothing to run" } },
        { id: "s", type: "stack", x: 0, y: 0, title: "S", items: [{ id: "a", kind: "live", file: "" }, { id: "b", kind: "live", src: "/live/hello.html" }] },
      ],
      wires: [],
    });
    const board = parseBoard(text)!;
    expect(board.nodes.map((n) => n.id)).toEqual(["s"]);
    expect((board.nodes[0].data as { items: { id: string }[] }).items.map((i) => i.id)).toEqual(["b"]);
  });

  it("round-trips a stack's description, and leaves it out when there is none", () => {
    const stack = (data: object) => ({ id: "s", type: "stack", position: { x: 0, y: 0 }, data: { title: "Blue", items: [], ...data } });
    const withLine = { nodes: [stack({ description: "What the brand already owns" })], edges: [] };
    const file = toBoardFile(withLine);
    expect(file.nodes[0]).toEqual({ id: "s", x: 0, y: 0, type: "stack", title: "Blue", description: "What the brand already owns", items: [] });
    expect(parseBoard(JSON.stringify(file))!.nodes).toEqual(withLine.nodes);

    expect(toBoardFile({ nodes: [stack({ description: "  " })], edges: [] }).nodes[0]).not.toHaveProperty("description");
    const bare = parseBoard(JSON.stringify(toBoardFile({ nodes: [stack({})], edges: [] })))!;
    expect(bare.nodes[0].data).not.toHaveProperty("description");
  });

  it("round-trips areas with their size and title", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [
        { id: "a", type: "area", x: -64, y: 32, w: 640, h: 384, title: "Inspiration" },
        { id: "n", type: "note", x: 0, y: 64, text: "hi" },
      ],
      wires: [],
    });
    const board = parseBoard(text)!;
    expect(board.nodes[0]).toMatchObject({ id: "a", type: "area", position: { x: -64, y: 32 }, width: 640, height: 384, data: { title: "Inspiration" } });
    expect(board.nodes[0].zIndex).toBeLessThan(0);
    expect(toBoardFile(board).nodes[0]).toEqual({ id: "a", x: -64, y: 32, type: "area", w: 640, h: 384, title: "Inspiration" });
    expect(serialize(parseBoard(serialize(board))!)).toBe(serialize(board));
  });

  it("opens an area with a missing size or title at a usable size", () => {
    const board = parseBoard(JSON.stringify({ forma: 1, nodes: [{ id: "a", type: "area", x: 0, y: 0 }], wires: [] }))!;
    expect(board.nodes[0]).toMatchObject({ width: 384, height: 256, data: { title: "New area" } });
  });

  it("rejects text that isn't a board", () => {
    expect(parseBoard("not json")).toBeNull();
    expect(parseBoard('{"hello": 1}')).toBeNull();
  });

  it("round-trips an image's note, palette, source and date", () => {
    const item = {
      id: "i",
      kind: "image" as const,
      file: "media/a.jpg",
      src: "shown:media/a.jpg",
      w: 300,
      h: 200,
      note: "The calm blue\n\nThis is the one.",
      palette: ["#1d3b6f", "#f4f1ea"],
      source: "https://www.are.na/block/1",
      added: "2026-11-02",
    };
    const board = { nodes: [{ id: "c", type: "card", position: { x: 0, y: 0 }, data: { item } }], edges: [] };
    const text = serialize(board);
    expect(JSON.parse(text).nodes[0].item).toMatchObject({ note: item.note, palette: item.palette, source: item.source, added: item.added });
    const back = parseBoard(text, (f) => `shown:${f}`)!;
    expect(back.nodes).toEqual(board.nodes);
    expect(serialize(back)).toBe(text);
  });

  it("drops an image's details when they are malformed, and an empty note", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [
        {
          id: "c",
          type: "card",
          x: 0,
          y: 0,
          item: { id: "i", file: "media/a.jpg", note: "  ", palette: ["#ABCDEF", "red", 3, "#fff"], source: 42, added: "soon" },
        },
        { id: "d", type: "card", x: 0, y: 0, item: { id: "j", file: "media/b.jpg", palette: "blue", source: " Dieter Rams " } },
      ],
      wires: [],
    });
    const [a, b] = parseBoard(text)!.nodes.map((n) => (n.data as { item: Record<string, unknown> }).item);
    expect(a).toEqual({ id: "i", kind: "image", file: "media/a.jpg", src: "media/a.jpg", palette: ["#abcdef"] });
    expect(b).toEqual({ id: "j", kind: "image", file: "media/b.jpg", src: "media/b.jpg", source: "Dieter Rams" });
    const saved = toBoardFile({
      nodes: [{ id: "c", type: "card", position: { x: 0, y: 0 }, data: { item: { id: "i", kind: "image", file: "a.jpg", note: "" } } }],
      edges: [],
    });
    expect(saved.nodes[0]).toEqual({ id: "c", x: 0, y: 0, type: "card", item: { id: "i", kind: "image", file: "a.jpg" } });
  });

  it("keeps where a loose note came from, and drops an empty one", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [
        { id: "a", type: "note", x: 0, y: 0, text: "Call", source: "https://notes.granola.ai/d/1" },
        { id: "b", type: "note", x: 0, y: 0, text: "Mine", source: " " },
      ],
      wires: [],
    });
    const board = parseBoard(text)!;
    expect(board.nodes[0].data).toEqual({ text: "Call", source: "https://notes.granola.ai/d/1" });
    expect(board.nodes[1].data).toEqual({ text: "Mine" });
    expect(toBoardFile(board).nodes[0]).toMatchObject({ source: "https://notes.granola.ai/d/1" });
    expect(toBoardFile(board).nodes[1]).not.toHaveProperty("source");
  });

  it("keeps the project's working files, each once and only links", () => {
    const text = JSON.stringify({
      forma: 1,
      nodes: [{ id: "p", type: "project", x: 0, y: 0, title: "F", brief: "", links: ["https://github.com/a/b", "nope", "https://github.com/a/b"] }],
      wires: [],
    });
    const board = parseBoard(text)!;
    expect(board.nodes[0].data).toEqual({ title: "F", brief: "", links: ["https://github.com/a/b"] });
    expect(toBoardFile(board).nodes[0]).toMatchObject({ links: ["https://github.com/a/b"] });
  });
});

describe("a new board's old brief prompt", () => {
  it("reads as no brief, so it never passes for the user's words", () => {
    const board = parseBoard(
      JSON.stringify({ forma: 1, nodes: [{ id: "project", type: "project", x: 0, y: 0, title: "ojo", brief: "What is this project? Double-click a note to start writing." }], wires: [] }),
    )!;
    expect((board.nodes[0].data as { brief: string }).brief).toBe("");
  });
});
