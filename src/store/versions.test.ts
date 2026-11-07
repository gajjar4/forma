import { describe, expect, it } from "vitest";
import {
  EVERY_MS,
  hashPath,
  historyKey,
  latestFirst,
  shouldKeep,
  toPrune,
  versionLabel,
  versionLabels,
  versionName,
  versionTime,
} from "./versions";

describe("historyKey", () => {
  it("is the folder's name and a hash of its whole path", () => {
    expect(historyKey("/Users/d/Documents/Forma/Neos")).toMatch(/^Neos-[0-9a-f]{16}$/);
    expect(historyKey("/Users/d/Documents/Forma/Neos/")).toBe(historyKey("/Users/d/Documents/Forma/Neos"));
  });

  it("tells apart folders with the same name", () => {
    expect(historyKey("/a/Neos")).not.toBe(historyKey("/b/Neos"));
    expect(hashPath("/a/Neos")).toBe(hashPath("/a/Neos"));
  });

  it("keeps only safe characters", () => {
    expect(historyKey("/x/My board: v2")).toMatch(/^My-board-v2-[0-9a-f]{16}$/);
    expect(historyKey("/x/Дошка")).toMatch(/^board-[0-9a-f]{16}$/);
    expect(historyKey("/x/../..")).toMatch(/^board-[0-9a-f]{16}$/);
  });
});

describe("version names", () => {
  it("round-trip the time and sort by it", () => {
    const t = Date.UTC(2026, 10, 3, 14, 32, 5, 123);
    expect(versionName(t)).toBe("board-2026-11-03T14-32-05-123Z.json");
    expect(versionTime(versionName(t))).toBe(t);
    expect(versionName(t) < versionName(t + 1)).toBe(true);
  });

  it("ignore anything else in the folder", () => {
    expect(versionTime("board.json")).toBeNull();
    expect(versionTime("board-2026-11-03T14-32-05-123Z.json.saving")).toBeNull();
    expect(versionTime(".DS_Store")).toBeNull();
  });

  it("list the latest first", () => {
    const names = [versionName(1000), "notes.txt", versionName(3000), versionName(2000)];
    expect(latestFirst(names).map((v) => v.time)).toEqual([3000, 2000, 1000]);
  });
});

describe("toPrune", () => {
  it("lets go of the oldest past the limit", () => {
    const names = [1, 2, 3, 4, 5].map((s) => versionName(s * 1000));
    expect(toPrune(names, 3)).toEqual([versionName(2000), versionName(1000)]);
    expect(toPrune(names, 5)).toEqual([]);
  });

  it("never touches files that aren't versions", () => {
    expect(toPrune(["board.json", ".DS_Store", versionName(1)], 0)).toEqual([versionName(1)]);
  });
});

describe("shouldKeep", () => {
  const at = 1_000_000;
  it("keeps the first one", () => {
    expect(shouldKeep(null, "{}", at, "save")).toBe(true);
  });

  it("never keeps nothing, or the same text twice", () => {
    expect(shouldKeep(null, "", at, "save")).toBe(false);
    expect(shouldKeep({ at: 0, text: "{a}" }, "{a}", at, "outside")).toBe(false);
  });

  it("keeps at most one every so often while you edit", () => {
    const last = { at, text: "{a}" };
    expect(shouldKeep(last, "{b}", at + 5_000, "save")).toBe(false);
    expect(shouldKeep(last, "{b}", at + EVERY_MS, "save")).toBe(true);
  });

  it("always keeps the board before a change from outside, a restore, or leaving", () => {
    const last = { at, text: "{a}" };
    expect(shouldKeep(last, "{b}", at + 1, "outside")).toBe(true);
    expect(shouldKeep(last, "{b}", at + 1, "restore")).toBe(true);
    expect(shouldKeep(last, "{b}", at + 1, "leave")).toBe(true);
  });
});

describe("versionLabel", () => {
  const now = new Date(2026, 10, 3, 18, 0).getTime();
  it("says today and yesterday", () => {
    expect(versionLabel(new Date(2026, 10, 3, 14, 32).getTime(), now)).toBe("Today 14:32");
    expect(versionLabel(new Date(2026, 10, 2, 9, 10).getTime(), now)).toBe("Yesterday 09:10");
  });

  it("gives the day further back, and the year when it isn't this one", () => {
    expect(versionLabel(new Date(2026, 9, 28, 7, 5).getTime(), now)).toBe("28 Oct 07:05");
    expect(versionLabel(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe("31 Dec 2025 23:59");
  });

  it("adds seconds only where two would read the same", () => {
    const a = new Date(2026, 10, 3, 14, 32, 5).getTime();
    const b = new Date(2026, 10, 3, 14, 32, 40).getTime();
    const c = new Date(2026, 10, 3, 14, 10).getTime();
    expect(versionLabels([b, a, c], now)).toEqual(["Today 14:32:40", "Today 14:32:05", "Today 14:10"]);
  });
});
