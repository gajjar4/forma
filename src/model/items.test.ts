import { describe, expect, it } from "vitest";
import {
  asUrl,
  dayLabel,
  faviconUrl,
  faviconUrls,
  rootDomain,
  fromPastedText,
  hostOf,
  isoDay,
  itemShape,
  linkLabel,
  LIVE_MAX_HEIGHT,
  LIVE_SHAPE,
  LIVE_WIDTH,
  liveSize,
  noteParts,
  NOTE_SHAPE,
  sourceLabel,
} from "./items";

describe("itemShape", () => {
  it("keeps an image's own proportions", () => {
    expect(itemShape({ id: "a", kind: "image", w: 400, h: 225 })).toEqual({ w: 400, h: 225 });
    expect(itemShape({ id: "a", kind: "image" })).toEqual({ w: 1, h: 1 });
  });

  it("gives notes and links a fixed shape", () => {
    expect(itemShape({ id: "n", kind: "note", text: "hi" })).toEqual(NOTE_SHAPE);
    const link = itemShape({ id: "l", kind: "link", url: "https://a.com" });
    expect(link.w).toBeGreaterThan(link.h);
  });
});

describe("live cards", () => {
  it("keep the shape their file gives, or 4:3", () => {
    expect(itemShape({ id: "l", kind: "live", src: "/live/a.html", w: 640, h: 400 })).toEqual({ w: 640, h: 400 });
    expect(itemShape({ id: "l", kind: "live", src: "/live/a.html" })).toEqual(LIVE_SHAPE);
    expect(LIVE_SHAPE.w / LIVE_SHAPE.h).toBeCloseTo(4 / 3);
  });

  it("sit a fixed width on the board, with their height from the shape", () => {
    expect(liveSize({ id: "l", kind: "live", w: 640, h: 400 })).toEqual({ w: LIVE_WIDTH, h: 200 });
    expect(liveSize({ id: "l", kind: "live" })).toEqual({ w: LIVE_WIDTH, h: 240 });
  });

  it("get narrower rather than too tall", () => {
    const tall = liveSize({ id: "l", kind: "live", w: 390, h: 844 });
    expect(tall.h).toBe(LIVE_MAX_HEIGHT);
    expect(tall.w).toBeLessThan(LIVE_WIDTH);
  });
});

describe("noteParts", () => {
  it("splits the heading from the body", () => {
    expect(noteParts("Founders call\n\nCalm.\n\nBlue and white.")).toEqual({
      head: "Founders call",
      body: ["Calm.", "Blue and white."],
    });
  });

  it("copes with a single line and with empty text", () => {
    expect(noteParts("Just this")).toEqual({ head: "Just this", body: [] });
    expect(noteParts("")).toEqual({ head: "", body: [] });
  });
});

describe("asUrl", () => {
  it("accepts web addresses", () => {
    expect(asUrl("https://linear.app/method")).toBe("https://linear.app/method");
    expect(asUrl("  http://example.com  ")).toBe("http://example.com/");
    expect(asUrl("www.are.na")).toBe("https://www.are.na/");
  });

  it("refuses text that only looks a bit like one", () => {
    expect(asUrl("see https://a.com")).toBeNull();
    expect(asUrl("example.com")).toBeNull();
    expect(asUrl("ftp://a.com")).toBeNull();
    expect(asUrl("https://nodot")).toBeNull();
    expect(asUrl("")).toBeNull();
  });
});

describe("links", () => {
  it("names the host without www", () => {
    expect(hostOf("https://www.are.na/block/1")).toBe("are.na");
  });

  it("puts the title first and the host under it", () => {
    expect(linkLabel({ id: "l", kind: "link", url: "https://www.are.na/x", title: "Are.na" })).toEqual({
      title: "Are.na",
      sub: "are.na",
      host: "are.na",
    });
  });

  it("leads with the host when there is no title, and never says it twice", () => {
    expect(linkLabel({ id: "l", kind: "link", url: "https://linear.app/method/" }).title).toBe("linear.app");
    expect(linkLabel({ id: "l", kind: "link", url: "https://linear.app/method/" }).sub).toBe("/method");
    expect(linkLabel({ id: "l", kind: "link", url: "https://linear.app" }).sub).toBe("");
  });

  it("asks for the site's icon by host", () => {
    expect(faviconUrl("https://www.are.na/x")).toBe("https://www.google.com/s2/favicons?domain=are.na&sz=64");
  });
});

describe("fromPastedText", () => {
  it("makes a link of an address and a note of anything else", () => {
    expect(fromPastedText("https://a.com")).toEqual({ kind: "link", url: "https://a.com/" });
    expect(fromPastedText(" Calm and trustworthy \n")).toEqual({ kind: "note", text: "Calm and trustworthy" });
    expect(fromPastedText("   ")).toBeNull();
  });

  it("stores the day an image was added as YYYY-MM-DD, and reads it back as a date", () => {
    expect(isoDay(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
    expect(dayLabel("2026-11-02")).toBe("2 Nov 2026");
    expect(dayLabel("2026-01-09T10:00:00Z")).toBe("9 Jan 2026");
    expect(dayLabel("yesterday")).toBeNull();
    expect(dayLabel("2026-13-01")).toBeNull();
    expect(dayLabel(undefined)).toBeNull();
  });

  it("shows a web source as its site, and words as they are", () => {
    expect(sourceLabel("https://www.are.na/block/123")).toEqual({ text: "are.na", url: "https://www.are.na/block/123" });
    expect(sourceLabel(" Dieter Rams ")).toEqual({ text: "Dieter Rams", url: null });
  });
});

describe("faviconUrls", () => {
  it("tries the host, then its main domain", () => {
    expect(faviconUrls("https://notes.granola.ai/d/1").map((u) => new URL(u).searchParams.get("domain"))).toEqual([
      "notes.granola.ai",
      "granola.ai",
    ]);
    expect(faviconUrls("https://mobbin.com/x")).toHaveLength(1);
  });

  it("keeps country domains whole", () => {
    expect(rootDomain("news.bbc.co.uk")).toBe("bbc.co.uk");
    expect(rootDomain("www.are.na")).toBe("are.na");
  });
});
