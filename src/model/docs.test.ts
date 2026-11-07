import { describe, expect, it } from "vitest";
import { baseName, docExt, docFileName, docPath, docShape, docTitle, docType, freeName, isDocFile, namesFor, safeFileName, DOC_SHAPE } from "./docs";
import type { Item } from "./types";

const doc = (fields: Partial<Item>): Item => ({ id: "d", kind: "doc", ...fields });

describe("documents", () => {
  it("are every file that isn't a picture or a video", () => {
    expect(isDocFile({ name: "brief.pdf", type: "application/pdf" })).toBe(true);
    expect(isDocFile({ name: "Notes.md", type: "" })).toBe(true);
    expect(isDocFile({ name: "App.fig", type: "" })).toBe(true);
    expect(isDocFile({ name: "shot.png", type: "" })).toBe(false);
    expect(isDocFile({ name: "clip", type: "video/mp4" })).toBe(false);
  });

  it("are named after their file, or their title when they have one", () => {
    expect(docFileName(doc({ file: "media/Interview notes.md" }))).toBe("Interview notes.md");
    expect(docTitle(doc({ file: "media/Interview notes.md" }))).toBe("Interview notes");
    expect(docTitle(doc({ file: "media/a.md", title: " Calls " }))).toBe("Calls");
    expect(baseName("asset://localhost/%2FUsers%2Fme%2FBrief%202.pdf")).toBe("Brief 2.pdf");
    expect(docFileName(doc({ src: "data:application/pdf;base64,AAA", title: "Deck.pdf" }))).toBe("Deck.pdf");
    expect(docTitle(doc({ src: "data:application/pdf;base64,AAA", title: "Deck.pdf" }))).toBe("Deck");
    expect(docExt(doc({ file: "media/Deck.KEY" }))).toBe("key");
  });

  it("show as a PDF, as text, or as a plain file", () => {
    expect(docType(doc({ file: "media/a.pdf" }))).toBe("pdf");
    expect(docType(doc({ file: "media/a.markdown" }))).toBe("text");
    expect(docType(doc({ file: "media/a.txt" }))).toBe("text");
    expect(docType(doc({ file: "media/a.sketch" }))).toBe("file");
    expect(docType(doc({ file: "media/README" }))).toBe("file");
  });

  it("sit as a sheet, or as a PDF's own page held to sane proportions", () => {
    expect(docShape(doc({ file: "media/a.md" }))).toEqual(DOC_SHAPE);
    expect(docShape(doc({ file: "media/a.pdf", w: 600, h: 800 }))).toEqual(DOC_SHAPE);
    expect(docShape(doc({ file: "media/a.pdf", posterSrc: "p", w: 960, h: 540 }))).toEqual({ w: 1778, h: 1000 });
    expect(docShape(doc({ file: "media/a.pdf", posterSrc: "p", w: 100, h: 2000 }))).toEqual({ w: 500, h: 1000 });
  });

  it("keep a readable, safe file name", () => {
    expect(safeFileName("Brief: v2/final.pdf")).toBe("Brief v2 final.pdf");
    expect(safeFileName(".hidden.md")).toBe("hidden.md");
    expect(safeFileName("   ")).toBe("document");
    expect(safeFileName(".pdf")).toBe("pdf");
    expect(safeFileName(`${"a".repeat(300)}.pdf`)).toHaveLength(124);
  });

  it("are made unique by a number, never written over", async () => {
    const names = namesFor("Brief.pdf");
    expect([names.next().value, names.next().value, names.next().value]).toEqual(["Brief.pdf", "Brief 2.pdf", "Brief 3.pdf"]);
    const taken = new Set(["Brief.pdf", "Brief 2.pdf"]);
    expect(await freeName("Brief.pdf", async (n) => taken.has(n))).toBe("Brief 3.pdf");
    expect(await freeName("Notes", async (n) => n === "Notes")).toBe("Notes 2");
    expect(await freeName("x.md", async () => true, 36)).toBe("x 10.md");
  });

  it("open only files inside the board, and never one that runs", () => {
    expect(docPath("/b/Forma/North/", doc({ file: "media/Brief.pdf" }))).toBe("/b/Forma/North/media/Brief.pdf");
    expect(docPath(undefined, doc({ file: "media/Brief.pdf" }))).toBeNull();
    expect(docPath("/b", doc({ file: "../../Applications/x.pdf" }))).toBeNull();
    expect(docPath("/b", doc({ file: "/etc/hosts" }))).toBeNull();
    expect(docPath("/b", doc({ file: "media/setup.command" }))).toBeNull();
    expect(docPath("/b", doc({ file: "media/Tool.app" }))).toBeNull();
    expect(docPath("/b", doc({ src: "https://a.co/x.pdf" }))).toBeNull();
  });
});
