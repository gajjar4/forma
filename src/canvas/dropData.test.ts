import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import type { StackData } from "../model/types";
import { fileInto, isMediaFile, landedSize, landingSpots, readDrop, stackUnder, wouldTake, type DropData } from "./dropData";

const file = (name: string, type = "") => new File(["x"], name, { type });

/** A drop carrying these files and these strings, by type. */
function drop(files: File[], strings: Record<string, string> = {}): DropData {
  return {
    files,
    types: [...(files.length ? ["Files"] : []), ...Object.keys(strings)],
    getData: (type) => strings[type] ?? "",
  };
}

describe("files from Finder", () => {
  it("takes images and videos, by type or by name", () => {
    expect(isMediaFile(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(isMediaFile(file("clip.MOV"))).toBe(true);
    expect(isMediaFile(file("shot.heic"))).toBe(true);
    expect(isMediaFile(file("brief.pdf", "application/pdf"))).toBe(false);
  });

  it("takes every file of a mixed drop: pictures, videos and documents", () => {
    const d = readDrop(drop([file("a.png", "image/png"), file("b.pdf", "application/pdf"), file("c.mp4", "video/mp4")]));
    expect(d?.kind).toBe("files");
    expect(d?.kind === "files" && d.files.map((f) => f.name)).toEqual(["a.png", "b.pdf", "c.mp4"]);
  });

  it("takes documents as files, not a note of their paths", () => {
    const d = readDrop(drop([file("b.pdf", "application/pdf")], { "text/uri-list": "file:///b.pdf", "text/plain": "/b.pdf" }));
    expect(d).toEqual({ kind: "files", files: [expect.objectContaining({ name: "b.pdf" })], source: undefined });
  });
});

describe("from a browser", () => {
  it("keeps where a dragged picture came from beside its file", () => {
    const d = readDrop(drop([file("cat.jpg", "image/jpeg")], { "text/uri-list": "https://site.com/page" }));
    expect(d).toMatchObject({ kind: "files", source: "https://site.com/page" });
  });

  it("fetches a picture that comes only as an address, keeping the page it links to as its source", () => {
    const d = readDrop(
      drop([], {
        "text/uri-list": "https://site.com/post/1",
        "text/html": '<a href="https://site.com/post/1"><img src="https://cdn.site.com/a.jpg?w=800&amp;q=80"></a>',
      }),
    );
    expect(d).toEqual({ kind: "image-url", url: "https://cdn.site.com/a.jpg?w=800&q=80", source: "https://site.com/post/1" });
  });

  it("takes a picture written into the page as data", () => {
    const d = readDrop(drop([], { "text/uri-list": "https://images.google.com/", "text/html": '<img src="data:image/jpeg;base64,AAAA">' }));
    expect(d).toMatchObject({ kind: "image-url", url: "data:image/jpeg;base64,AAAA" });
  });

  it("reads an address that is itself a picture as one", () => {
    expect(readDrop(drop([], { "text/uri-list": "https://cdn.site.com/b.webp" }))).toMatchObject({ kind: "image-url", url: "https://cdn.site.com/b.webp" });
  });

  it("makes a dragged link a link card", () => {
    const d = readDrop(drop([], { "text/uri-list": "https://linear.app/method", "text/html": '<a href="https://linear.app/method">Method</a>' }));
    expect(d).toEqual({ kind: "link", url: "https://linear.app/method" });
  });

  it("makes dragged text a note, even with a picture in the selection", () => {
    const d = readDrop(drop([], { "text/plain": "Calm and trustworthy", "text/html": '<p>Calm <img src="https://a.com/i.png"> and trustworthy</p>' }));
    expect(d).toEqual({ kind: "note", text: "Calm and trustworthy" });
  });

  it("is nothing for an empty drag", () => {
    expect(readDrop(drop([], { "text/plain": "   " }))).toBeNull();
  });
});

describe("while a drag moves", () => {
  it("takes any file, and text and links", () => {
    expect(wouldTake(["Files"])).toBe(true);
    expect(wouldTake(["text/plain"])).toBe(true);
    expect(wouldTake(["text/uri-list"])).toBe(true);
    expect(wouldTake(["application/x-moz-whatever"])).toBe(false);
  });
});

describe("where it lands", () => {
  it("centres one thing on the pointer, on the dots", () => {
    const [p] = landingSpots([{ w: 168, h: 168 }], { x: 400, y: 300 });
    expect(p).toEqual({ x: 320, y: 224 });
    expect(p.x % 32).toBe(0);
  });

  it("lays several out as a small group around the pointer", () => {
    const spots = landingSpots(Array.from({ length: 4 }, () => ({ w: 168, h: 168 })), { x: 0, y: 0 });
    expect(spots).toHaveLength(4);
    // Two rows of two, none on top of another.
    expect(new Set(spots.map((s) => s.x)).size).toBe(2);
    expect(new Set(spots.map((s) => s.y)).size).toBe(2);
    expect(spots.every((s) => s.x % 32 === 0 && s.y % 32 === 0)).toBe(true);
    // Around the pointer, give or take the snap to the dots.
    const xs = spots.map((s) => s.x + 84);
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThanOrEqual(32);
  });

  it("sizes each kind the way the board draws it", () => {
    expect(landedSize({ id: "n", kind: "note", text: "Hi" })).toEqual({ w: 256, h: 120 });
    expect(landedSize({ id: "i", kind: "image", w: 1200, h: 600 })).toEqual({ w: 168, h: 84 });
    expect(landedSize({ id: "l", kind: "link", url: "https://a.com" }).w).toBe(200);
    expect(landedSize({ id: "d", kind: "doc", file: "media/a.md" })).toEqual({ w: 152, h: 200 });
  });
});

describe("onto a stack", () => {
  const stack: Node = { id: "s", type: "stack", position: { x: 0, y: 0 }, data: { title: "Blue", items: [{ id: "a", kind: "image" }] } };
  const rect = (x: number, y: number) => ({ x, y, w: 200, h: 200 });

  it("finds the stack under the pointer, unless a card sits on top of it", () => {
    const things = [{ id: "s", type: "stack", rect: rect(0, 0) }];
    expect(stackUnder({ x: 100, y: 100 }, things)).toBe("s");
    expect(stackUnder({ x: 300, y: 100 }, things)).toBeNull();
    expect(stackUnder({ x: 100, y: 100 }, [...things, { id: "c", type: "card", rect: rect(50, 50) }])).toBeNull();
  });

  it("files what was dropped on top of the pile, the last one the cover", () => {
    const [next] = fileInto([stack], "s", [{ id: "b", kind: "image" }, { id: "c", kind: "link", url: "https://a.com" }]);
    expect((next.data as StackData).items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});
