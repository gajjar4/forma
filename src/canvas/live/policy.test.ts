import { describe, expect, it } from "vitest";
import { decide, MAX_RUNNING, START_AFTER_MS, STOP_AFTER_MS, type LiveCandidate, type LiveScene, type LiveTrack } from "./policy";

const scene = (now: number, more: Partial<LiveScene> = {}): LiveScene => ({ now, detail: true, moving: false, held: false, ...more });
const card = (id: string, distance = 0, visible = true): LiveCandidate => ({ id, visible, distance });

/** Runs the rules at each time in turn, carrying the tracks along. */
function play(steps: [LiveCandidate[], LiveScene][]) {
  let tracks = new Map<string, LiveTrack>();
  let last = decide([], scene(0), tracks);
  for (const [cards, s] of steps) {
    last = decide(cards, s, tracks);
    tracks = last.tracks;
  }
  return last;
}

describe("which live cards run", () => {
  it("starts a card once it has been on screen for a moment, not before", () => {
    const first = play([[[card("a")], scene(0)]]);
    expect(first.running.size).toBe(0);
    expect(first.nextAt).toBe(START_AFTER_MS);
    const later = play([
      [[card("a")], scene(0)],
      [[card("a")], scene(START_AFTER_MS)],
    ]);
    expect([...later.running]).toEqual(["a"]);
  });

  it("never runs a card that is off screen or zoomed out past the detail", () => {
    const off = play([
      [[card("a", 0, false)], scene(0)],
      [[card("a", 0, false)], scene(START_AFTER_MS * 4)],
    ]);
    expect(off.running.size).toBe(0);
    const far = play([
      [[card("a")], scene(0, { detail: false })],
      [[card("a")], scene(START_AFTER_MS * 4, { detail: false })],
    ]);
    expect(far.running.size).toBe(0);
  });

  it("starts nothing while the board moves, but keeps what already runs", () => {
    const moving = play([
      [[card("a")], scene(0, { moving: true })],
      [[card("a")], scene(START_AFTER_MS * 2, { moving: true })],
    ]);
    expect(moving.running.size).toBe(0);
    // Once the board rests, a card that has been in view long enough starts at once.
    const rested = play([
      [[card("a")], scene(0, { moving: true })],
      [[card("a")], scene(START_AFTER_MS * 2)],
    ]);
    expect([...rested.running]).toEqual(["a"]);
    const kept = play([
      [[card("a")], scene(0)],
      [[card("a")], scene(START_AFTER_MS)],
      [[card("a")], scene(START_AFTER_MS + 50, { moving: true })],
    ]);
    expect([...kept.running]).toEqual(["a"]);
  });

  it("keeps a card running for a while after it leaves the view, then stops it", () => {
    const steps: [LiveCandidate[], LiveScene][] = [
      [[card("a")], scene(0)],
      [[card("a")], scene(START_AFTER_MS)],
      [[card("a", 0, false)], scene(1000)],
    ];
    const gone = play(steps);
    expect([...gone.running]).toEqual(["a"]);
    expect(gone.nextAt).toBe(1000 + STOP_AFTER_MS);
    const stopped = play([...steps, [[card("a", 0, false)], scene(1000 + STOP_AFTER_MS)]]);
    expect(stopped.running.size).toBe(0);
    // Back in view before the time is up: it never stopped.
    const back = play([...steps, [[card("a")], scene(1500)], [[card("a")], scene(1000 + STOP_AFTER_MS * 2)]]);
    expect([...back.running]).toEqual(["a"]);
  });

  it(`runs at most ${MAX_RUNNING}, the ones nearest the middle of the view`, () => {
    const cards = Array.from({ length: 8 }, (_, i) => card(`c${i}`, 100 - i * 10));
    const now = play([
      [cards, scene(0)],
      [cards, scene(START_AFTER_MS)],
    ]);
    expect(now.running.size).toBe(MAX_RUNNING);
    expect([...now.running].sort()).toEqual(["c4", "c5", "c6", "c7"]);
  });

  it("hands a slot to a nearer card only once the farther one has stopped", () => {
    const far = [card("a", 10), card("b", 20), card("c", 30), card("d", 40)];
    const near = [...far.slice(0, 3), card("d", 40, false), card("e", 5)];
    const steps: [LiveCandidate[], LiveScene][] = [
      [far, scene(0)],
      [far, scene(START_AFTER_MS)],
      [near, scene(1000)],
      [near, scene(1000 + START_AFTER_MS)],
    ];
    const waiting = play(steps);
    expect(waiting.running.has("e")).toBe(false);
    expect(waiting.running.size).toBe(MAX_RUNNING);
    const swapped = play([...steps, [near, scene(1000 + STOP_AFTER_MS)]]);
    expect([...swapped.running].sort()).toEqual(["a", "b", "c", "e"]);
  });

  it("winds everything down while something sits over the board", () => {
    const steps: [LiveCandidate[], LiveScene][] = [
      [[card("a")], scene(0)],
      [[card("a")], scene(START_AFTER_MS)],
      [[card("a")], scene(1000, { held: true })],
    ];
    expect([...play(steps).running]).toEqual(["a"]);
    expect(play([...steps, [[card("a")], scene(1000 + STOP_AFTER_MS, { held: true })]]).running.size).toBe(0);
  });

  it("forgets cards that left the board", () => {
    const out = play([
      [[card("a")], scene(0)],
      [[card("a")], scene(START_AFTER_MS)],
      [[], scene(400)],
    ]);
    expect(out.tracks.size).toBe(0);
    expect(out.running.size).toBe(0);
  });
});
