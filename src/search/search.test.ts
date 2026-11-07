import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { Item } from "../model/types";
import { fold, indexBoard, search, words } from "./search";

const note = (id: string, text: string, source?: string): Node => ({ id, type: "note", position: { x: 0, y: 0 }, data: { text, source } });
const stack = (id: string, title: string, items: Item[], description?: string): Node => ({
  id,
  type: "stack",
  position: { x: 0, y: 0 },
  data: { title, items, description },
});
const card = (id: string, item: Item): Node => ({ id, type: "card", position: { x: 0, y: 0 }, data: { item } });
const img = (id: string, extra: Partial<Item> = {}): Item => ({ id, kind: "image", src: `/m/${id}.jpg`, w: 10, h: 10, ...extra });
const wire = (id: string, source: string, target: string, note?: string): Edge => ({ id, source, target, type: "link", data: { note } });

const board: Node[] = [
  { id: "project", type: "project", position: { x: 0, y: 0 }, data: { title: "Northwind", brief: "AI shopping assistant for small brands.", links: ["https://www.figma.com/file/abc"] } },
  note("n-founders", "Founders call, 20 Oct\n\nThey want it calm and trustworthy. Blue and white keeps coming up."),
  note("n-cafe", "Café visit\n\nThe menu is set in a soft serif."),
  stack("s-motion", "Motion", [
    img("i-checkout", { title: "Blue checkout screen", source: "https://mobbin.com/screens/1", added: "2026-10-01" }),
    img("i-onboard", { title: "Onboarding", source: "https://mobbin.com/screens/2", added: "2026-11-02" }),
    { id: "l-linear", kind: "link", url: "https://linear.app/method" },
  ], "How things move"),
  card("c-robot", img("i-robot", { title: "Round robot", note: "The blue they pointed at." })),
  card("c-untitled", img("i-plain", { source: "https://www.are.na/block/1" })),
];
const edges = [wire("e1", "n-founders", "s-motion", "They like blue and white"), wire("e2", "project", "n-cafe")];
const index = indexBoard(board, edges);
const keys = (q: string) => search(index, q).map((r) => r.key);

describe("fold", () => {
  it("drops case and accents, and maps back to the original text", () => {
    const f = fold("Café É");
    expect(f.text).toBe("cafe e");
    expect(f.starts[3]).toBe(3);
    expect(f.ends[3]).toBe(4);
  });

  it("splits a query into folded words", () => {
    expect(words("  Blue   CHECKOUT ")).toEqual(["blue", "checkout"]);
  });
});

describe("search", () => {
  it("finds nothing for an empty query", () => {
    expect(search(index, "   ")).toEqual([]);
  });

  it("needs every word to match somewhere, in any field", () => {
    expect(keys("blue checkout")).toEqual(["s-motion/i-checkout"]);
    expect(keys("checkout mobbin")).toEqual(["s-motion/i-checkout"]);
    expect(keys("checkout purple")).toEqual([]);
  });

  it("ignores case and accents both ways", () => {
    expect(keys("CAFE")).toContain("n-cafe");
    expect(keys("café")).toContain("n-cafe");
  });

  it("puts a match in a name before one in the words", () => {
    const blue = keys("blue");
    expect(blue[0]).toBe("s-motion/i-checkout");
    expect(blue.indexOf("s-motion/i-checkout")).toBeLessThan(blue.indexOf("n-founders"));
    expect(blue.indexOf("wire:e1")).toBeLessThan(blue.indexOf("c-robot"));
  });

  it("finds everything from a source by its site, newest first", () => {
    expect(keys("mobbin")).toEqual(["s-motion/i-onboard", "s-motion/i-checkout"]);
    expect(keys("are.na")).toEqual(["c-untitled"]);
  });

  it("finds links by their address, the project by its brief and its files, stacks by their description", () => {
    expect(keys("linear")).toEqual(["s-motion/l-linear"]);
    expect(keys("shopping")).toEqual(["project"]);
    expect(keys("figma")).toEqual(["project"]);
    expect(keys("move")).toEqual(["s-motion"]);
  });

  it("says where a stack item sits and what a thing is", () => {
    const [item] = search(index, "checkout");
    expect(item.meta).toBe("in Motion");
    expect(item.target).toEqual({ kind: "item", nodeId: "s-motion", itemId: "i-checkout" });
    const [w] = search(index, "like blue");
    expect(w.meta).toBe("wire note");
    expect(w.target).toEqual({ kind: "wire", wireId: "e1", from: "n-founders", to: "s-motion" });
    expect(search(index, "robot")[0].meta).toBe("image");
  });

  it("marks the matches in the name, and shows the words that matched when the name doesn't", () => {
    const [r] = search(index, "blue screen");
    expect(r.line.text).toBe("Blue checkout screen");
    expect(r.line.marks).toEqual([
      [0, 4],
      [14, 20],
    ]);
    expect(r.snippet).toBeNull();
    const [robot] = search(index, "robot pointed");
    expect(robot.line.text).toBe("Round robot");
    expect(robot.snippet?.text).toBe("The blue they pointed at.");
    expect(robot.snippet?.marks).toEqual([[14, 21]]);
  });

  it("shows an untitled thing by the words that matched", () => {
    const [r] = search(index, "are.na");
    expect(r.line.text).toBe("are.na/block/1");
    expect(r.snippet).toBeNull();
  });

  it("starts a long text a little before its first match", () => {
    const [r] = search(index, "coming");
    expect(r.line.text).toBe("Founders call, 20 Oct");
    expect(r.snippet?.text.startsWith("…")).toBe(true);
    const [a, b] = r.snippet!.marks[0];
    expect(r.snippet!.text.slice(a, b)).toBe("coming");
  });

  it("gives each thing a thumbnail where it has one", () => {
    expect(search(index, "checkout")[0].thumb).toEqual({ still: "/m/i-checkout.jpg" });
    expect(search(index, "linear")[0].thumb).toEqual({ site: "https://linear.app/method" });
    expect(search(index, "founders")[0].thumb).toBeNull();
  });

  it("leaves out wires with no note", () => {
    expect(index.some((e) => e.key === "wire:e2")).toBe(false);
  });
});
