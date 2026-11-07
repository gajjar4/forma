import { describe, expect, it } from "vitest";
import { emptyHistory, LIMIT, record, redo, undo } from "./history";

describe("history", () => {
  it("undoes and redoes in order", () => {
    let h = record(emptyHistory<number>(), 1);
    h = record(h, 2);
    const u = undo(h, 3)!;
    expect(u.state).toBe(2);
    const r = redo(u.history, u.state)!;
    expect(r.state).toBe(3);
  });

  it("clears redo after a new change", () => {
    const h = record(emptyHistory<number>(), 1);
    const u = undo(h, 2)!;
    expect(record(u.history, u.state).future).toEqual([]);
  });

  it("returns null with nothing to undo or redo", () => {
    expect(undo(emptyHistory(), 1)).toBeNull();
    expect(redo(emptyHistory(), 1)).toBeNull();
  });

  it("keeps a bounded past", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < LIMIT + 20; i++) h = record(h, i);
    expect(h.past).toHaveLength(LIMIT);
    expect(h.past[0]).toBe(20);
  });
});
