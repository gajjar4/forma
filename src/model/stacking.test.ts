import { describe, expect, it } from "vitest";
import { pushItems, resolveDrop } from "./stacking";

const box = (x: number, y: number, w = 100, h = 100) => ({ x, y, w, h });

describe("resolveDrop", () => {
  const stack = { id: "s1", type: "stack", rect: box(0, 0, 200, 200) };
  const card = { id: "c2", type: "card", rect: box(400, 0) };

  it("adds a card to the stack its centre lands on", () => {
    const dragged = { id: "c1", type: "card", rect: box(60, 60) };
    expect(resolveDrop(dragged, [stack, card])).toEqual({
      type: "add-to-stack",
      stackId: "s1",
    });
  });

  it("ignores a light overlap", () => {
    const dragged = { id: "c1", type: "card", rect: box(180, 180) };
    expect(resolveDrop(dragged, [stack])).toEqual({ type: "none" });
  });

  it("makes a new stack from two cards", () => {
    const dragged = { id: "c1", type: "card", rect: box(420, 20) };
    expect(resolveDrop(dragged, [stack, card])).toEqual({
      type: "new-stack",
      withId: "c2",
    });
  });

  it("merges a stack dropped on a stack", () => {
    const dragged = { id: "s2", type: "stack", rect: box(50, 50) };
    expect(resolveDrop(dragged, [stack])).toEqual({
      type: "merge-stacks",
      stackId: "s1",
    });
  });

  it("never stacks onto the project, or moves it", () => {
    const project = { id: "p", type: "project", rect: box(0, 0, 300, 300) };
    const dragged = { id: "c1", type: "card", rect: box(50, 50) };
    expect(resolveDrop(dragged, [project])).toEqual({ type: "none" });
    const moved = { id: "p", type: "project", rect: box(0, 0) };
    expect(resolveDrop(moved, [stack])).toEqual({ type: "none" });
  });

  it("files a note into a stack", () => {
    const dragged = { id: "n1", type: "note", rect: box(60, 60) };
    expect(resolveDrop(dragged, [stack])).toEqual({ type: "add-to-stack", stackId: "s1" });
  });

  it("makes a new stack from a note and a card, either way round, or two notes", () => {
    const note = { id: "n2", type: "note", rect: box(400, 300, 260, 140) };
    expect(resolveDrop({ id: "n1", type: "note", rect: box(420, 20) }, [card])).toEqual({ type: "new-stack", withId: "c2" });
    expect(resolveDrop({ id: "c1", type: "card", rect: box(450, 300) }, [note])).toEqual({ type: "new-stack", withId: "n2" });
    expect(resolveDrop({ id: "n1", type: "note", rect: box(450, 300) }, [note])).toEqual({ type: "new-stack", withId: "n2" });
  });

  it("only merges a stack into a stack, never onto a card or note", () => {
    const note = { id: "n2", type: "note", rect: box(400, 0, 260, 140) };
    expect(resolveDrop({ id: "s2", type: "stack", rect: box(420, 20) }, [card, note])).toEqual({ type: "none" });
  });

  it("prefers the target drawn on top", () => {
    const under = { id: "s0", type: "stack", rect: box(0, 0, 300, 300) };
    const dragged = { id: "c1", type: "card", rect: box(60, 60) };
    expect(resolveDrop(dragged, [under, stack])).toEqual({
      type: "add-to-stack",
      stackId: "s1",
    });
  });
});

describe("pushItems", () => {
  it("appends without duplicates", () => {
    const a = { id: "a", kind: "image" as const };
    const b = { id: "b", kind: "image" as const };
    expect(pushItems([a], [a, b]).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("areas and stacking", () => {
  const area = { id: "a", type: "area", rect: box(-500, -500, 2000, 2000) };

  it("never files anything into an area", () => {
    const dragged = { id: "c1", type: "card", rect: box(60, 60) };
    expect(resolveDrop(dragged, [area])).toEqual({ type: "none" });
  });

  it("looks past an area to what sits on it", () => {
    const stack = { id: "s1", type: "stack", rect: box(0, 0, 200, 200) };
    const dragged = { id: "c1", type: "card", rect: box(60, 60) };
    expect(resolveDrop(dragged, [stack, area])).toEqual({ type: "add-to-stack", stackId: "s1" });
  });

  it("never stacks an area", () => {
    expect(resolveDrop({ ...area, rect: box(0, 0) }, [{ id: "s1", type: "stack", rect: box(0, 0, 200, 200) }])).toEqual({ type: "none" });
  });
});
