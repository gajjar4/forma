import { describe, expect, it } from "vitest";
import { sharedSource } from "./source";
import type { Item } from "./types";

const from = (source?: string): Item => ({ id: Math.random().toString(36), kind: "image", source });

describe("sharedSource", () => {
  it("names the one place everything came from", () => {
    expect(sharedSource([from("https://mobbin.com/a"), from("https://www.mobbin.com/b")])).toBe("https://mobbin.com/a");
  });

  it("says nothing when they differ, or one doesn't say, or it isn't a web address", () => {
    expect(sharedSource([from("https://mobbin.com/a"), from("https://are.na/b")])).toBeNull();
    expect(sharedSource([from("https://mobbin.com/a"), from()])).toBeNull();
    expect(sharedSource([from("Dieter Rams")])).toBeNull();
    expect(sharedSource([])).toBeNull();
  });
});
