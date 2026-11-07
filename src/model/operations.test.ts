import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { applyDrop, itemsOf, moveWires, nodeFromItem, patchItem, reorderStack, takeOut } from "./operations";
import type { Item, StackData } from "./types";

const item = (id: string) => ({ id, kind: "image" as const });
const card = (id: string, x = 0): Node => ({ id, type: "card", position: { x, y: 0 }, data: { item: item(id) } });
const stack = (id: string, ids: string[]): Node => ({
  id,
  type: "stack",
  position: { x: 0, y: 0 },
  data: { title: id, items: ids.map(item) },
});
const wire = (id: string, source: string, target: string): Edge => ({ id, source, target });
const note = (id: string, text: string, x = 0): Node => ({ id, type: "note", position: { x, y: 0 }, data: { text } });
const linkCard = (id: string, url: string): Node => ({
  id,
  type: "card",
  position: { x: 0, y: 0 },
  data: { item: { id: `i-${id}`, kind: "link", url } },
});
const itemsIn = (n: Node) => (n.data as StackData).items;

describe("applyDrop", () => {
  it("moves a card into a stack and keeps its wires on the stack", () => {
    const g = {
      nodes: [card("c1"), stack("s1", ["a"]), card("p")],
      edges: [wire("w1", "p", "c1")],
    };
    const out = applyDrop(g, "c1", { type: "add-to-stack", stackId: "s1" });
    expect(out.nodes.map((n) => n.id)).toEqual(["s1", "p"]);
    expect((out.nodes[0].data as { items: unknown[] }).items).toHaveLength(2);
    expect(out.edges).toEqual([{ id: "w1", source: "p", target: "s1" }]);
  });

  it("turns two cards into a new stack where the target was", () => {
    const g = { nodes: [card("c1"), card("c2", 300)], edges: [] };
    const out = applyDrop(g, "c1", { type: "new-stack", withId: "c2" });
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].type).toBe("stack");
    expect(out.nodes[0].position).toEqual({ x: 300, y: 0 });
  });
});

describe("applyDrop with notes and links", () => {
  it("files a note into a stack as a note item, wires and all", () => {
    const g = {
      nodes: [note("n1", "Founders call\n\nCalm."), stack("s1", ["a"]), card("p")],
      edges: [wire("w1", "p", "n1")],
    };
    const out = applyDrop(g, "n1", { type: "add-to-stack", stackId: "s1" });
    expect(out.nodes.map((n) => n.id)).toEqual(["s1", "p"]);
    expect(itemsIn(out.nodes[0]).slice(-1)[0]).toEqual({ id: "n1", kind: "note", text: "Founders call\n\nCalm." });
    expect(out.edges).toEqual([{ id: "w1", source: "p", target: "s1" }]);
  });

  it("files a link card into a stack", () => {
    const g = { nodes: [linkCard("l1", "https://are.na/"), stack("s1", ["a"])], edges: [] };
    const out = applyDrop(g, "l1", { type: "add-to-stack", stackId: "s1" });
    expect(itemsIn(out.nodes[0]).slice(-1)[0]).toEqual({ id: "i-l1", kind: "link", url: "https://are.na/" });
  });

  it("starts a stack from two notes, the dragged one on top", () => {
    const g = { nodes: [note("n1", "one"), note("n2", "two", 300)], edges: [wire("w", "n1", "n2")] };
    const out = applyDrop(g, "n1", { type: "new-stack", withId: "n2" });
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0].position).toEqual({ x: 300, y: 0 });
    expect(itemsIn(out.nodes[0]).map((i) => i.text)).toEqual(["two", "one"]);
    expect(out.edges).toEqual([]);
  });

  it("starts a stack from a note and an image card", () => {
    const g = { nodes: [note("n1", "one"), card("c2", 300)], edges: [] };
    const out = applyDrop(g, "n1", { type: "new-stack", withId: "c2" });
    expect(itemsIn(out.nodes[0]).map((i) => i.kind)).toEqual(["image", "note"]);
  });

  it("carries nothing from the project", () => {
    expect(itemsOf({ id: "p", type: "project", position: { x: 0, y: 0 }, data: {} })).toEqual([]);
  });
});

describe("nodeFromItem", () => {
  const at = { x: 1, y: 2 };

  it("puts a note back as a note node", () => {
    const n = nodeFromItem({ id: "n", kind: "note", text: "hi" }, at);
    expect(n.type).toBe("note");
    expect(n.data).toEqual({ text: "hi" });
    expect(n.position).toEqual(at);
  });

  it("keeps where a note came from, in and out of a stack", () => {
    const source = "https://notes.granola.ai/d/1";
    const n = nodeFromItem({ id: "n", kind: "note", text: "hi", source }, at);
    expect(n.data).toEqual({ text: "hi", source });
    expect(itemsOf({ ...n, data: { text: "hi", source } })[0]).toMatchObject({ kind: "note", source });
  });

  it("puts links and images back as cards", () => {
    const link: Item = { id: "l", kind: "link", url: "https://a.com/" };
    expect(nodeFromItem(link, at)).toMatchObject({ type: "card", data: { item: link } });
    expect(nodeFromItem(item("i"), at)).toMatchObject({ type: "card", data: { item: item("i") } });
  });
});

describe("moveWires", () => {
  it("drops loops and duplicates", () => {
    const edges = [wire("a", "x", "c1"), wire("b", "x", "s1"), wire("c", "c1", "s1")];
    expect(moveWires(edges, ["c1"], "s1").map((e) => e.id)).toEqual(["a"]);
  });
});

describe("reorderStack", () => {
  const ids = (g: { nodes: Node[] }) => (g.nodes[0].data as { items: { id: string }[] }).items.map((i) => i.id);

  it("applies the new order", () => {
    const g = { nodes: [stack("s1", ["a", "b", "c"])], edges: [] };
    expect(ids(reorderStack(g, "s1", ["c", "a", "b"]))).toEqual(["c", "a", "b"]);
  });

  it("never loses an item left out of the list", () => {
    const g = { nodes: [stack("s1", ["a", "b", "c"])], edges: [] };
    expect(ids(reorderStack(g, "s1", ["c", "x", "a"]))).toEqual(["b", "c", "a"]);
  });
});

describe("takeOut", () => {
  it("puts the item beside the stack", () => {
    const g = { nodes: [stack("s1", ["a", "b"])], edges: [] };
    const out = takeOut(g, "s1", "a", { x: 10, y: 20 });
    expect(out.nodes).toHaveLength(2);
    expect(out.nodes[1].position).toEqual({ x: 10, y: 20 });
  });

  it("takes a note out as a note node", () => {
    const g = {
      nodes: [{ ...stack("s1", ["a"]), data: { title: "s", items: [item("a"), { id: "n", kind: "note" as const, text: "hi" }] } }],
      edges: [],
    };
    const out = takeOut(g, "s1", "n", { x: 0, y: 0 });
    expect(out.nodes.map((n) => n.type)).toEqual(["stack", "note"]);
    expect(out.nodes[1].data).toEqual({ text: "hi" });
  });

  it("removes a stack that ends up empty, with its wires", () => {
    const g = { nodes: [stack("s1", ["a"]), card("p")], edges: [wire("w", "p", "s1")] };
    const out = takeOut(g, "s1", "a", { x: 0, y: 0 });
    expect(out.nodes.map((n) => n.type)).toEqual(["card", "card"]);
    expect(out.edges).toEqual([]);
  });
});

describe("patchItem", () => {
  it("changes a loose card's item and an item in a stack, and nothing else", () => {
    const nodes = [card("a"), stack("s", ["b", "c"]), note("n", "hi")];
    const once = patchItem(nodes, "a", { title: "A" });
    expect((once[0].data as { item: Item }).item.title).toBe("A");
    expect(once[1]).toBe(nodes[1]);
    const twice = patchItem(nodes, "c", { title: "C" });
    expect(itemsIn(twice[1]).map((i) => i.title)).toEqual([undefined, "C"]);
    expect(twice[0]).toBe(nodes[0]);
    expect(twice[2]).toBe(nodes[2]);
  });
});
