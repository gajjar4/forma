import { describe, expect, it } from "vitest";
import { dialsOf, getAt, labelOf, readDialsMessage, sameValues, setAt, snapToStep, startValues } from "./dials";

const config = {
  spread: [1, 0.4, 1.8, 0.05],
  loop: true,
  spring: { type: "spring", stiffness: 420, damping: 31 },
  broken: [1, 2],
};

describe("dialsOf", () => {
  it("flattens sliders, switches and groups, and skips what it can't read", () => {
    const dials = dialsOf(config);
    expect(dials.map((d) => `${d.kind}:${d.path}`)).toEqual([
      "slider:spread",
      "switch:loop",
      "group:spring",
      "slider:spring.stiffness",
      "slider:spring.damping",
    ]);
    expect(dials[0]).toMatchObject({ min: 0.4, max: 1.8, step: 0.05, initial: 1, label: "Spread" });
    expect(dials[3]).toMatchObject({ min: 1, max: 1000 });
  });

  it("guesses a range for a bare number", () => {
    expect(dialsOf({ gap: 16 })[0]).toMatchObject({ min: 0, max: 48, step: 1 });
    expect(dialsOf({ turn: -42 })[0]).toMatchObject({ min: -126, max: 126 });
  });
});

describe("labelOf", () => {
  it("turns keys into words", () => {
    expect(labelOf("visualDuration")).toBe("Visual duration");
    expect(labelOf("max_gap")).toBe("Max gap");
  });
});

describe("startValues", () => {
  it("starts from the defaults, passing other keys through", () => {
    expect(startValues(config)).toEqual({
      spread: 1,
      loop: true,
      spring: { type: "spring", stiffness: 420, damping: 31 },
      broken: [1, 2],
    });
  });

  it("keeps saved values that still fit, inside their range", () => {
    const v = startValues(config, { spread: 9, loop: false, spring: { damping: 12 }, gone: 3 });
    expect(v.spread).toBe(1.8);
    expect(v.loop).toBe(false);
    expect(v.spring).toEqual({ type: "spring", stiffness: 420, damping: 12 });
    expect(v).not.toHaveProperty("gone");
  });
});

describe("getAt and setAt", () => {
  it("read and change nested values without touching the original", () => {
    const v = startValues(config);
    const next = setAt(v, "spring.damping", 20);
    expect(getAt(next, "spring.damping")).toBe(20);
    expect(getAt(v, "spring.damping")).toBe(31);
    expect(getAt(next, "spread")).toBe(1);
  });
});

describe("snapToStep", () => {
  it("snaps to the step and stays in range", () => {
    const d = { min: 0.4, max: 1.8, step: 0.05 };
    expect(snapToStep(1.0333, d)).toBe(1.05);
    expect(snapToStep(5, d)).toBe(1.8);
    expect(snapToStep(0.1 + 0.2, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
  });
});

describe("readDialsMessage", () => {
  it("reads a component's dials", () => {
    const c = { spread: [18, 0, 40] };
    expect(readDialsMessage({ forma: "dials", config: c, name: "Fan" })).toEqual({ config: c, name: "Fan" });
    expect(readDialsMessage({ forma: "dials", config: c, name: " " })).toEqual({ config: c, name: undefined });
  });

  it("ignores anything else", () => {
    expect(readDialsMessage(null)).toBeNull();
    expect(readDialsMessage("dials")).toBeNull();
    expect(readDialsMessage({ forma: "values", config: {} })).toBeNull();
    expect(readDialsMessage({ forma: "dials", config: [1, 2] })).toBeNull();
    expect(readDialsMessage({ forma: "dials" })).toBeNull();
  });
});

describe("sameValues", () => {
  it("compares tuned values", () => {
    expect(sameValues({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(sameValues({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameValues(undefined, { a: 1 })).toBe(false);
  });
});
