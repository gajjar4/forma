// Live state for the grid effects: which thing the pointer is over and which
// of its ports. The wire being pulled is read straight from React Flow's
// store. DotGrid subscribes and turns this into dots; nothing here renders.

import type { Node } from "@xyflow/react";
import type { Side } from "./gridFx.math";

export type GridFxState = {
  /** The thing under the pointer: its ports show as dot "+"s. */
  hover: string | null;
  /** The port under the pointer: its "+" grows a little. */
  port: { node: string; side: Side } | null;
  /** Where something dragged in from outside would land, on a dot: a "+" gathers there. */
  drop: { x: number; y: number } | null;
};

let state: GridFxState = { hover: null, port: null, drop: null };
const listeners = new Set<() => void>();

export const gridFx = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

function set(next: Partial<GridFxState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

/** How close (screen px) the pointer can stay to a thing after leaving it and keep its "+"s. */
export const NEAR = 56;
/** How long the "+"s wait after the pointer leaves, so you can travel out to them. */
export const GRACE = 450;

let leaving: string | null = null;
let leaveTimer: number | undefined;
let pointer: { x: number; y: number } | null = null;

function nearNode(id: string) {
  if (!pointer) return false;
  const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return pointer.x > r.left - NEAR && pointer.x < r.right + NEAR && pointer.y > r.top - NEAR && pointer.y < r.bottom + NEAR;
}

function clearLeaving() {
  window.clearTimeout(leaveTimer);
  leaving = null;
}

function letGo(id: string) {
  clearLeaving();
  if (state.hover === id) set({ hover: null });
}

/** For ReactFlow's `onNodeMouseEnter`. */
export const hoverNode = (_: unknown, node: Node) => {
  clearLeaving();
  set({ hover: node.id });
};

/**
 * For ReactFlow's `onNodeMouseLeave`. The "+"s don't vanish the moment the
 * pointer crosses the edge: they stay while it is still near the thing (on
 * its way out to a "+"), and only go once it moves away or the grace passes.
 */
export const leaveNode = (_: unknown, node: Node) => {
  if (state.hover !== node.id) return;
  clearLeaving();
  leaving = node.id;
  const check = () => {
    if (leaving !== node.id) return;
    if (nearNode(node.id)) leaveTimer = window.setTimeout(check, GRACE);
    else letGo(node.id);
  };
  leaveTimer = window.setTimeout(check, GRACE);
};

/** For the board's pointer moves: lets go of a thing as soon as the pointer is well away from it. */
export const trackPointer = (e: { clientX: number; clientY: number }) => {
  pointer = { x: e.clientX, y: e.clientY };
  if (leaving && !nearNode(leaving)) letGo(leaving);
};

/** For a port's own pointer events. */
export const hoverPort = (node: string, side: Side) => set({ port: { node, side } });
export const leavePort = (node: string, side: Side) => {
  if (state.port?.node === node && state.port.side === side) set({ port: null });
};

/** For a drag from outside the app: the dot it would land on, or null once it leaves or lands. */
export const dropAt = (p: { x: number; y: number } | null) => {
  const was = state.drop;
  if (was === p || (was && p && was.x === p.x && was.y === p.y)) return;
  set({ drop: p });
};
