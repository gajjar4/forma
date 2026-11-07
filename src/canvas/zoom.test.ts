import { describe, expect, it } from "vitest";
import { DETAIL_OFF, DETAIL_ON, detailShows, MAX_WAIT_MS, nextWrite, SETTLE_MS } from "./zoom";

describe("detailShows", () => {
  it("shows the detail near, hides it far", () => {
    expect(detailShows(1, true)).toBe(true);
    expect(detailShows(0.3, true)).toBe(false);
    expect(detailShows(0.3, false)).toBe(false);
    expect(detailShows(1, false)).toBe(true);
  });

  it("holds its state between the two lines, so it doesn't flicker", () => {
    const between = (DETAIL_OFF + DETAIL_ON) / 2;
    expect(detailShows(between, true)).toBe(true);
    expect(detailShows(between, false)).toBe(false);
  });
});

describe("nextWrite", () => {
  it("waits for the zoom to rest", () => {
    expect(nextWrite(1000, 1000)).toBe(1000 + SETTLE_MS);
  });

  it("still catches up during a long zoom", () => {
    expect(nextWrite(1000 + MAX_WAIT_MS - 10, 1000)).toBe(1000 + MAX_WAIT_MS);
  });
});
