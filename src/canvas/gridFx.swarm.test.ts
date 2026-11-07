import { describe, expect, it } from "vitest";
import { dotKey } from "./gridFx.math";
import { DotSwarm, GATHER, type Env, type Want } from "./gridFx.swarm";

const env = (over: Partial<Env> = {}): Env => ({
  grid: 32,
  reach: 120,
  borrow: true,
  reduced: false,
  blocked: () => false,
  px: 1,
  ...over,
});

const want = (x: number, y: number, extra: Partial<Want> = {}): Want => ({ x, y, size: 3, boost: 3, spring: GATHER, ...extra });

const run = (s: DotSwarm, e: Env, frames = 120) => {
  let moving = true;
  for (let i = 0; i < frames && moving; i++) moving = s.step(1 / 60, e);
  return moving;
};

describe("DotSwarm", () => {
  it("borrows the nearest free grid dot and starts it at its grid home", () => {
    const s = new DotSwarm();
    s.sync(new Map([["a", want(40, 70)]]), env());
    const d = s.dots.get("a")!;
    expect(d.home).toEqual({ i: 1, j: 2 });
    expect([d.x, d.y]).toEqual([32, 64]);
    expect(s.borrowed.has(dotKey(1, 2))).toBe(true);
  });

  it("never lends one grid dot twice", () => {
    const s = new DotSwarm();
    s.sync(new Map([["a", want(40, 70)], ["b", want(40, 70)], ["c", want(40, 70)]]), env());
    const homes = [...s.dots.values()].map((d) => dotKey(d.home!.i, d.home!.j));
    expect(new Set(homes).size).toBe(3);
  });

  it("flies to the target, then home again, and gives the dot back to the grid", () => {
    const s = new DotSwarm();
    const e = env();
    s.sync(new Map([["a", want(40, 70)]]), e);
    expect(run(s, e)).toBe(false);
    const d = s.dots.get("a")!;
    expect(d.x).toBeCloseTo(40, 1);
    expect(d.l).toBeCloseTo(1, 2);
    s.sync(new Map(), e);
    expect(run(s, e, 240)).toBe(false);
    expect(s.size).toBe(0);
    expect(s.borrowed.size).toBe(0);
  });

  it("spawns in place when the grid has nothing to lend", () => {
    const s = new DotSwarm();
    const e = env({ borrow: false });
    s.sync(new Map([["a", want(40, 70)]]), e);
    const d = s.dots.get("a")!;
    expect(d.home).toBeNull();
    expect([d.x, d.y]).toEqual([40, 70]);
    run(s, e);
    s.sync(new Map(), e);
    run(s, e, 240);
    expect(s.size).toBe(0);
  });

  it("leaves dots under cards alone", () => {
    const s = new DotSwarm();
    s.sync(new Map([["a", want(40, 70)]]), env({ blocked: (i, j) => i === 1 && j === 2 }));
    expect(s.dots.get("a")!.home).not.toEqual({ i: 1, j: 2 });
  });

  it("hands a wire point over to a nearer dot once it has moved far from home", () => {
    const s = new DotSwarm();
    const e = env();
    s.sync(new Map([["w", want(0, 0, { handoff: 150 })]]), e);
    const first = s.dots.get("w")!;
    s.sync(new Map([["w", want(410, 0, { handoff: 150 })]]), e);
    const next = s.dots.get("w")!;
    expect(next).not.toBe(first);
    expect(next.home).toEqual({ i: 13, j: 0 });
    expect(first.want).toBeNull();
    expect(s.size).toBe(2);
  });

  it("catches a dot on its way home instead of making a new one", () => {
    const s = new DotSwarm();
    const e = env();
    s.sync(new Map([["w", want(40, 0, { handoff: 80 })]]), e);
    const first = s.dots.get("w")!;
    const borrowed = s.borrowed.size;
    s.sync(new Map(), e); // the wire moved on: the dot heads home
    s.sync(new Map([["w2", want(50, 10, { handoff: 80 })]]), e);
    expect(s.dots.get("w2")).toBe(first);
    expect(s.borrowed.size).toBe(borrowed);
    expect(s.size).toBe(1);
  });

  it("does not catch a dot whose home is far from where it is needed", () => {
    const s = new DotSwarm();
    const e = env();
    s.sync(new Map([["w", want(0, 0, { handoff: 80 })]]), e);
    const first = s.dots.get("w")!;
    s.sync(new Map(), e);
    s.sync(new Map([["w2", want(400, 0, { handoff: 80 })]]), e);
    expect(s.dots.get("w2")).not.toBe(first);
    expect(s.dots.get("w2")!.home).not.toBeNull();
  });

  it("with reduced motion only fades, never flies", () => {
    const s = new DotSwarm();
    const e = env({ reduced: true });
    s.sync(new Map([["a", want(40, 70)]]), e);
    expect(s.dots.get("a")!.home).toBeNull();
    s.step(1 / 60, e);
    expect([s.dots.get("a")!.x, s.dots.get("a")!.y]).toEqual([40, 70]);
  });
});
