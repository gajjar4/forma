import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { Item } from "../model/types";
import { boardName, editedLabel, folderNameFor, metaLine, orderBoards, pileOf, summarize, thingCount, type BoardSummary } from "./summary";

const img = (id: string): Item => ({ id, kind: "image", src: `/m/${id}.jpg`, w: 300, h: 300 });
const at = { position: { x: 0, y: 0 } };
const stack = (id: string, items: Item[]): Node => ({ id, type: "stack", ...at, data: { title: id, items } });
const card = (id: string, item: Item): Node => ({ id, type: "card", ...at, data: { item } });
const note = (id: string, text: string): Node => ({ id, type: "note", ...at, data: { text } });
const project = (title: string): Node => ({ id: "project", type: "project", ...at, data: { title, brief: "" } });
const area: Node = { id: "area", type: "area", ...at, data: { title: "Look" } };

describe("pileOf", () => {
  it("takes each stack's cover and each loose picture before a second from any", () => {
    const board = {
      nodes: [stack("a", [img("a1"), img("a2"), img("a3")]), card("c", img("c1")), stack("b", [img("b1"), img("b2")])],
      edges: [],
    };
    expect(pileOf(board).map((i) => i.id)).toEqual(["a3", "c1", "b2", "a2"]);
  });

  it("shows a video by its still, and skips one without", () => {
    const withStill: Item = { id: "v1", kind: "video", src: "/v.mp4", posterSrc: "/v.jpg" };
    const without: Item = { id: "v2", kind: "video", src: "/w.mp4" };
    const board = { nodes: [card("x", without), card("y", withStill)], edges: [] };
    expect(pileOf(board).map((i) => i.id)).toEqual(["v1"]);
  });

  it("falls back to notes, and to nothing", () => {
    const link: Item = { id: "l", kind: "link", url: "https://a.b" };
    expect(pileOf({ nodes: [note("n1", "One"), card("l", link)], edges: [] }).map((i) => i.text)).toEqual(["One"]);
    expect(pileOf({ nodes: [project("P")], edges: [] })).toEqual([]);
  });
});

describe("a board's name and count", () => {
  it("counts what was put there, not areas or the project", () => {
    expect(thingCount({ nodes: [project("P"), area, note("n", "x"), card("c", img("c"))], edges: [] })).toBe(2);
  });

  it("is named by its project, else its folder", () => {
    expect(boardName({ nodes: [project("Northwind")], edges: [] }, "nw")).toBe("Northwind");
    expect(boardName({ nodes: [project("  ")], edges: [] }, "nw")).toBe("nw");
    expect(summarize({ nodes: [], edges: [] }, "/x/Folder", "Folder", 5)).toEqual({
      root: "/x/Folder",
      name: "Folder",
      count: 0,
      faces: [],
      edited: 5,
    });
  });
});

describe("editedLabel", () => {
  const now = new Date(2026, 10, 2, 9, 0).getTime();
  it("says today, yesterday, or the day", () => {
    expect(editedLabel(new Date(2026, 10, 2, 0, 5).getTime(), now)).toBe("today");
    expect(editedLabel(new Date(2026, 10, 1, 23, 50).getTime(), now)).toBe("yesterday");
    expect(editedLabel(new Date(2026, 9, 28).getTime(), now)).toBe("28 Oct");
    expect(editedLabel(new Date(2025, 10, 2).getTime(), now)).toBe("2 Nov 2025");
  });
  it("reads a time a little in the future as today", () => {
    expect(editedLabel(now + 60_000, now)).toBe("today");
  });
  it("makes the line under a pile", () => {
    expect(metaLine({ count: 18, edited: now }, now)).toBe("18 things · edited today");
    expect(metaLine({ count: 1, edited: null }, now)).toBe("1 thing");
    expect(metaLine({ count: 0, edited: now }, now)).toBe("Empty · edited today");
  });
});

describe("orderBoards", () => {
  const b = (root: string, edited: number | null, name = root): BoardSummary => ({ root, name, count: 0, faces: [], edited });
  it("puts the latest first, undated last, each folder once", () => {
    const list = [b("/a", 1), b("/z", null, "Z"), b("/b", 3), b("/y", null, "Y"), b("/a", 9)];
    expect(orderBoards(list).map((x) => x.root)).toEqual(["/b", "/a", "/y", "/z"]);
  });
});

describe("folderNameFor", () => {
  it("makes a safe folder name", () => {
    expect(folderNameFor("  Spring / Summer: 2027  ", [])).toBe("Spring - Summer- 2027");
    expect(folderNameFor("..hidden", [])).toBe("hidden");
    expect(folderNameFor("tab\there", [])).toBe("tabhere");
    expect(folderNameFor("   ", [])).toBe("Untitled");
    expect(folderNameFor("x".repeat(100), [])).toHaveLength(64);
  });
  it("never takes a name already there, whatever its case", () => {
    expect(folderNameFor("Moodboard", ["moodboard", "Moodboard 2"])).toBe("Moodboard 3");
    expect(folderNameFor("Moodboard", ["Other"])).toBe("Moodboard");
  });
});
