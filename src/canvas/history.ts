// Undo and redo as whole-board snapshots. Boards are small, so a snapshot per
// change is simpler and safer than tracking individual edits.

export type History<T> = { past: T[]; future: T[] };

export const LIMIT = 100;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Remember `current` before a change. A new change clears redo. */
export function record<T>(h: History<T>, current: T): History<T> {
  return { past: [...h.past, current].slice(-LIMIT), future: [] };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return null;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future] }, state: prev };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  const next = h.future[0];
  if (next === undefined) return null;
  return { history: { past: [...h.past, current], future: h.future.slice(1) }, state: next };
}
