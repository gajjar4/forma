import { describe, expect, it } from "vitest";
import { withRecent } from "./projects";

describe("withRecent", () => {
  it("puts the folder first, once, and keeps the list short", () => {
    expect(withRecent(["/a", "/b"], "/c")).toEqual(["/c", "/a", "/b"]);
    expect(withRecent(["/a", "/b", "/c"], "/b")).toEqual(["/b", "/a", "/c"]);
    expect(withRecent(["/a", "/b", "/c"], "/d", 3)).toEqual(["/d", "/a", "/b"]);
  });
});
