import { describe, expect, it } from "vitest";
import { parseBoard, type Board, type BoardFile } from "../model/format";
import { diffBoards, keepMeasured, prints, readPrints, remember, unseen } from "./changes";

const base: BoardFile = {
  forma: 1,
  nodes: [
    { id: "project", type: "project", x: 0, y: 0, title: "Northwind", brief: "Shopping." },
    { id: "n1", type: "note", x: 400, y: 0, text: "Founders\n\nCalm." },
    {
      id: "s1",
      type: "stack",
      x: 0,
      y: 400,
      title: "Blue",
      items: [
        { id: "i1", kind: "image", file: "media/i1.jpg", w: 300, h: 300 },
        { id: "i2", kind: "note", text: "Navy" },
      ],
    },
    { id: "c1", type: "card", x: 800, y: 0, item: { id: "i3", kind: "image", file: "media/i3.jpg", w: 10, h: 10 } },
    { id: "a1", type: "area", x: -64, y: -64, w: 640, h: 320, title: "Look" },
  ],
  wires: [{ id: "w1", from: "project", to: "n1" }],
};

/** The base board with `edit` applied to a copy of its file. */
function board(edit: (f: BoardFile) => void = () => {}): Board {
  const file = structuredClone(base);
  edit(file);
  return parseBoard(JSON.stringify(file))!;
}

const nodeOf = (f: BoardFile, id: string) => f.nodes.find((n) => n.id === id)!;

describe("diffBoards", () => {
  it("finds nothing between a board and itself", () => {
    const d = diffBoards(board(), board());
    expect([d.added, d.changed, d.moved, d.removed, d.wires.added, d.wires.changed]).toEqual([[], [], [], [], [], []]);
  });

  it("tells added, changed and removed things apart", () => {
    const after = board((f) => {
      f.nodes.push({ id: "n2", type: "note", x: 0, y: 900, text: "New" });
      (nodeOf(f, "n1") as { text: string }).text = "Founders\n\nCalm and kind.";
      f.nodes = f.nodes.filter((n) => n.id !== "c1");
    });
    const d = diffBoards(board(), after);
    expect(d.added).toEqual(["n2"]);
    expect(d.changed).toEqual(["n1"]);
    expect(d.removed).toEqual(["c1"]);
    expect(d.moved).toEqual([]);
  });

  it("counts a move as a move, never as a change", () => {
    const d = diffBoards(board(), board((f) => (nodeOf(f, "n1").x = 640)));
    expect(d.moved).toEqual(["n1"]);
    expect(d.changed).toEqual([]);
  });

  it("marks a stack changed when it gains an item, and names the item", () => {
    const after = board((f) => {
      (nodeOf(f, "s1") as { items: unknown[] }).items.push({ id: "i4", kind: "link", url: "https://are.na" });
    });
    const d = diffBoards(board(), after);
    expect(d.changed).toEqual(["s1"]);
    expect(d.items.added).toEqual(["i4"]);
  });

  it("sees an image's note, palette and source as a change to it and its stack", () => {
    const after = board((f) => {
      const items = (nodeOf(f, "s1") as { items: Record<string, unknown>[] }).items;
      items[0] = { ...items[0], note: "The calm blue", palette: ["#1d3b6f"], source: "Are.na" };
    });
    const d = diffBoards(board(), after);
    expect(d.items.changed).toEqual(["i1"]);
    expect(d.changed).toEqual(["s1"]);
  });

  it("sees a reordered stack as changed: its cover is different", () => {
    const after = board((f) => (nodeOf(f, "s1") as { items: unknown[] }).items.reverse());
    expect(diffBoards(board(), after).changed).toEqual(["s1"]);
  });

  it("finds wires added, given a note, and removed", () => {
    const after = board((f) => {
      f.wires = [
        { id: "w1", from: "project", to: "n1", note: "Where it started" },
        { id: "w2", from: "n1", to: "s1" },
      ];
    });
    expect(diffBoards(board(), after).wires).toEqual({ added: ["w2"], changed: ["w1"], removed: [] });
    expect(diffBoards(after, board()).wires).toEqual({ added: [], changed: ["w1"], removed: ["w2"] });
  });

  it("ignores how an item is shown, only what is stored", () => {
    const a = parseBoard(JSON.stringify(base), (f) => `asset://one/${f}`)!;
    const b = parseBoard(JSON.stringify(base), (f) => `asset://two/${f}`)!;
    expect(diffBoards(a, b).changed).toEqual([]);
  });
});

describe("since last seen", () => {
  it("finds what is new or different since the board was last seen", () => {
    const seen = prints(board());
    const now = board((f) => {
      f.nodes.push({ id: "n2", type: "note", x: 0, y: 900, text: "New" });
      nodeOf(f, "project").x = 300;
      (nodeOf(f, "c1") as { item: { title?: string } }).item.title = "Robot";
      f.wires.push({ id: "w2", from: "n1", to: "c1" });
    });
    expect(unseen(seen, now)).toEqual({ nodes: ["n2", "c1"], wires: ["w2"], items: [] });
  });

  it("names the items in a stack that are new or different", () => {
    const seen = prints(board());
    const now = board((f) => {
      const items = (nodeOf(f, "s1") as { items: Record<string, unknown>[] }).items;
      items[1] = { ...items[1], text: "Navy and white" };
      items.push({ id: "i4", kind: "link", url: "https://are.na" });
    });
    expect(unseen(seen, now)).toEqual({ nodes: ["s1"], wires: [], items: ["i4", "i2"] });
  });

  it("finds no items new against prints kept before items were", () => {
    const { items: _items, ...old } = prints(board());
    const now = board((f) => (nodeOf(f, "s1") as { items: unknown[] }).items.push({ id: "i4", kind: "note", text: "x" }));
    expect(unseen(old, now).items).toEqual([]);
  });

  it("finds nothing on a board that only moved", () => {
    expect(unseen(prints(board()), board((f) => (nodeOf(f, "n1").y = 999)))).toEqual({ nodes: [], wires: [], items: [] });
  });

  it("keeps what is still waiting to be seen as it was last seen", () => {
    const before = prints(board());
    const later = board((f) => {
      (nodeOf(f, "n1") as { text: string }).text = "Changed";
      (nodeOf(f, "project") as { brief: string }).brief = "Changed too";
      f.nodes.push({ id: "n2", type: "note", x: 0, y: 900, text: "New" });
    });
    const kept = remember(before, prints(later), { nodes: new Set(["n1", "n2"]), wires: new Set(), items: new Set() });
    expect(kept.nodes.n1).toBe(before.nodes.n1);
    expect("n2" in kept.nodes).toBe(false);
    expect(kept.nodes.project).toBe(prints(later).nodes.project);
    // Opened again before looking: the same two are still new.
    expect(unseen(kept, later).nodes.sort()).toEqual(["n1", "n2"]);
  });

  it("forgets things that are gone", () => {
    const kept = remember(prints(board()), prints(board((f) => (f.nodes = f.nodes.filter((n) => n.id !== "n1")))), {
      nodes: new Set(),
      wires: new Set(),
      items: new Set(),
    });
    expect("n1" in kept.nodes).toBe(false);
  });

  it("reads stored prints back, and nothing else", () => {
    const p = prints(board());
    expect(readPrints(JSON.stringify(p))).toEqual(p);
    expect(readPrints(null)).toBeNull();
    expect(readPrints("not json")).toBeNull();
    expect(readPrints(JSON.stringify({ nodes: { a: 1 }, wires: {} }))).toBeNull();
  });
});

describe("keepMeasured", () => {
  type N = { id: string; type: string; measured?: { width: number; height: number } };
  const was: N = { id: "s1", type: "stack", measured: { width: 200, height: 229 } };
  const node = (id: string, type: string): N => ({ id, type });

  it("keeps the size a changed node was measured at", () => {
    expect(keepMeasured(node("s1", "stack"), was).measured).toEqual({ width: 200, height: 229 });
  });

  it("leaves a new node, a node of another kind, and a measured one alone", () => {
    expect(keepMeasured(node("s2", "stack"), undefined).measured).toBeUndefined();
    expect(keepMeasured(node("s1", "note"), was).measured).toBeUndefined();
    const measured: N = { id: "s1", type: "stack", measured: { width: 1, height: 1 } };
    expect(keepMeasured(measured, was)).toBe(measured);
  });
});
