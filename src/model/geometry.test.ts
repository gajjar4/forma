import { describe, expect, it } from "vitest";
import { anchorOn, aroundNote, splitCubic, wireEnds, wireFade, wirePath, noteRoom, NOTE_MIN_ROOM } from "./geometry";

const r = { x: 0, y: 0, w: 200, h: 100 };

describe("anchorOn", () => {
  it("leaves from the side facing the other end", () => {
    expect(anchorOn(r, { x: 600, y: 50 }).side).toBe("right");
    expect(anchorOn(r, { x: -600, y: 50 }).side).toBe("left");
    expect(anchorOn(r, { x: 100, y: 600 }).side).toBe("bottom");
    expect(anchorOn(r, { x: 100, y: -600 }).side).toBe("top");
  });

  it("sits just outside the edge", () => {
    const a = anchorOn(r, { x: 600, y: 50 });
    expect(a.x).toBeGreaterThan(200);
    expect(a.y).toBe(50);
  });

  it("keeps the end off the rounded corners", () => {
    const a = anchorOn(r, { x: 600, y: 2000 });
    expect(a.x).toBeLessThanOrEqual(188);
    expect(a.x).toBeGreaterThanOrEqual(12);
  });
});

describe("a body with a label below it", () => {
  const stack = { x: 0, y: 0, w: 200, h: 200, below: 60 };

  it("leaves the bottom below the label, never through it", () => {
    const a = anchorOn(stack, { x: 100, y: 900 });
    expect(a.side).toBe("bottom");
    expect(a.y).toBeGreaterThan(260);
  });

  it("aims the sides at the body itself", () => {
    const a = anchorOn(stack, { x: 900, y: 100 });
    expect(a.side).toBe("right");
    expect(a.y).toBe(100);
  });
});

describe("wireEnds", () => {
  it("faces the two rects toward each other", () => {
    const [a, b] = wireEnds(r, { x: 500, y: 0, w: 200, h: 100 });
    expect(a.side).toBe("right");
    expect(b.side).toBe("left");
  });
});

describe("wirePath", () => {
  it("puts the midpoint between the ends of a straight wire", () => {
    const { mid, path } = wirePath(
      { x: 0, y: 0, side: "right" },
      { x: 400, y: 0, side: "left" },
    );
    expect(mid).toEqual({ x: 200, y: 0 });
    expect(path.startsWith("M 0 0 C")).toBe(true);
  });
});

describe("wireFade", () => {
  it("fades over a fixed distance on a long wire", () => {
    const f = wireFade({ x: 0, y: 0 }, { x: 400, y: 0 }, 40);
    expect(f.start).toBeCloseTo(0.1);
    expect(f.end).toBeCloseTo(0.9);
  });

  it("never fades away a short wire", () => {
    const f = wireFade({ x: 0, y: 0 }, { x: 60, y: 0 }, 40);
    expect(f.start).toBeCloseTo(1 / 3);
    expect(f.end).toBeCloseTo(2 / 3);
  });
});

describe("splitCubic", () => {
  it("meets in the middle of a straight line", () => {
    const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }] as const;
    const [a, b] = splitCubic(line, 0.5);
    expect(a[3]).toEqual({ x: 150, y: 0 });
    expect(b[0]).toEqual({ x: 150, y: 0 });
    expect(b[3]).toEqual({ x: 300, y: 0 });
  });
});

describe("aroundNote", () => {
  const line = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 400, y: 0 }, { x: 600, y: 0 }] as const;

  it("cuts the wire just outside the note on both sides", () => {
    const cut = aroundNote(line, 50)!;
    expect(cut.before![0]).toEqual({ x: 0, y: 0 });
    expect(cut.before![3].x).toBeLessThan(300 - 50);
    expect(cut.before![3].x).toBeGreaterThan(300 - 60);
    expect(cut.after![0].x).toBeGreaterThan(300 + 50);
    expect(cut.after![3]).toEqual({ x: 600, y: 0 });
  });

  it("never draws through the note: a side with no room is left out", () => {
    expect(aroundNote(line, 290)).toEqual({ before: null, after: null });
    const off = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, { x: 600, y: 0 }] as const;
    const cut = aroundNote(off, 150)!;
    expect(cut.after).not.toBeNull();
  });
});

describe("noteRoom", () => {
  it("lets a note sit whole when the gap is wide or tall enough", () => {
    expect(noteRoom({ x: 0, y: 0 }, { x: 300, y: 0 }, 120)).toBeNull();
    expect(noteRoom({ x: 0, y: 0 }, { x: 20, y: 200 }, 200)).toBeNull();
  });

  it("cuts a note to the gap on a short level wire, never below a word or two", () => {
    expect(noteRoom({ x: 0, y: 0 }, { x: 120, y: 10 }, 200)).toBe(84);
    expect(noteRoom({ x: 0, y: 0 }, { x: 40, y: 10 }, 200)).toBe(NOTE_MIN_ROOM);
  });
});
