// Changes to the canvas as pure functions over nodes and edges. The canvas
// calls these; later the file layer and the AI can call the same ones.

import type { Edge, Node } from "@xyflow/react";
import { center, contains, NEW_STACK, pushItems, type DropAction, type Rect } from "./stacking";
import type { AreaData, CardData, Item, NoteData, StackData } from "./types";

type Graph = { nodes: Node[]; edges: Edge[] };

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Items a node carries into a stack. A note becomes a note item; it takes the
 * node's id, which is free again once the node is gone.
 */
export function itemsOf(node: Node): Item[] {
  if (node.type === "stack") return (node.data as StackData).items;
  if (node.type === "card") return [(node.data as CardData).item];
  if (node.type === "note") {
    const { text, source } = node.data as NoteData;
    return [{ id: node.id, kind: "note", text, ...(source ? { source } : {}) }];
  }
  return [];
}

/** The loose node an item becomes on the board: a note goes back to being a note, anything else a card. */
export function nodeFromItem(item: Item, at: { x: number; y: number }): Node {
  if (item.kind === "note") {
    const data: NoteData = item.source ? { text: item.text ?? "", source: item.source } : { text: item.text ?? "" };
    return { id: newId("note"), type: "note", position: at, data };
  }
  return { id: newId("card"), type: "card", position: at, data: { item } satisfies CardData };
}

/**
 * Points every wire that touched `from` at `to` instead, dropping wires that
 * would loop back on themselves or repeat an existing connection.
 */
export function moveWires(edges: Edge[], from: string[], to: string): Edge[] {
  const gone = new Set(from);
  const seen = new Set<string>();
  const out: Edge[] = [];
  for (const e of edges) {
    const source = gone.has(e.source) ? to : e.source;
    const target = gone.has(e.target) ? to : e.target;
    if (source === target) continue;
    const key = [source, target].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source === e.source && target === e.target ? e : { ...e, source, target });
  }
  return out;
}

/** Applies what a drop means. Returns the graph unchanged for "none". */
export function applyDrop(g: Graph, draggedId: string, action: DropAction): Graph {
  const dragged = g.nodes.find((n) => n.id === draggedId);
  if (!dragged || action.type === "none") return g;

  if (action.type === "add-to-stack" || action.type === "merge-stacks") {
    const nodes = g.nodes
      .filter((n) => n.id !== draggedId)
      .map((n) =>
        n.id === action.stackId
          ? { ...n, data: { ...n.data, items: pushItems(itemsOf(n), itemsOf(dragged)) } }
          : n,
      );
    return { nodes, edges: moveWires(g.edges, [draggedId], action.stackId) };
  }

  const other = g.nodes.find((n) => n.id === action.withId);
  if (!other) return g;
  const items = [...itemsOf(other), ...itemsOf(dragged)];
  const stack: Node = {
    id: newId("stack"),
    type: "stack",
    position: other.position,
    data: { title: NEW_STACK, items } satisfies StackData,
  };
  const nodes = [...g.nodes.filter((n) => n.id !== draggedId && n.id !== other.id), stack];
  return { nodes, edges: moveWires(g.edges, [draggedId, other.id], stack.id) };
}

/**
 * Puts a stack's items in a new order (last = the cover). Ids that aren't in
 * the stack are ignored; items missing from the list keep their place at the
 * bottom, so nothing is ever lost.
 */
export function reorderStack(g: Graph, stackId: string, itemIds: string[]): Graph {
  const nodes = g.nodes.map((n) => {
    if (n.id !== stackId) return n;
    const items = (n.data as StackData).items;
    const byId = new Map(items.map((i) => [i.id, i]));
    const ordered = itemIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const listed = new Set(ordered.map((i) => i.id));
    const rest = items.filter((i) => !listed.has(i.id));
    return { ...n, data: { ...n.data, items: [...rest, ...ordered] } };
  });
  return { nodes, edges: g.edges };
}

/**
 * Takes one item out of a stack and puts it on the canvas beside the stack, as
 * a note or a card. A stack left empty is removed.
 */
export function takeOut(g: Graph, stackId: string, itemId: string, at: { x: number; y: number }): Graph {
  const stack = g.nodes.find((n) => n.id === stackId);
  if (!stack) return g;
  const items = (stack.data as StackData).items;
  const item = items.find((i) => i.id === itemId);
  if (!item) return g;
  const rest = items.filter((i) => i.id !== itemId);
  const loose = nodeFromItem(item, at);
  const nodes = g.nodes.flatMap((n) => {
    if (n.id !== stackId) return [n];
    return rest.length ? [{ ...n, data: { ...n.data, items: rest } }] : [];
  });
  const edges = rest.length ? g.edges : g.edges.filter((e) => e.source !== stackId && e.target !== stackId);
  return { nodes: [...nodes, loose], edges };
}

/**
 * Changes one item wherever it is: a loose card or an item in a stack. Nodes
 * that don't hold it are left as they are.
 */
export function patchItem(nodes: Node[], itemId: string, patch: Partial<Item>): Node[] {
  return nodes.map((n) => {
    if (n.type === "card") {
      const { item } = n.data as CardData;
      return item.id === itemId ? { ...n, data: { ...n.data, item: { ...item, ...patch } } } : n;
    }
    if (n.type === "stack") {
      const { items } = n.data as StackData;
      if (!items.some((i) => i.id === itemId)) return n;
      return { ...n, data: { ...n.data, items: items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } };
    }
    return n;
  });
}

/** What a fresh area is called until you (or the AI) name it. */
export const NEW_AREA = "New area";

/** Areas sit under everything else, wires included, even while selected. */
export const AREA_Z = -2000;

/** The smallest an area can be, so its name always fits. */
export const AREA_MIN = { w: 128, h: 96 };

/** An area node. Its size lives on the node, so React Flow and the resizer use it directly. */
export function areaNode(id: string, r: { x: number; y: number; w: number; h: number }, title: string): Node {
  const w = Number.isFinite(r.w) ? Math.max(AREA_MIN.w, r.w) : 384;
  const h = Number.isFinite(r.h) ? Math.max(AREA_MIN.h, r.h) : 256;
  return {
    id,
    type: "area",
    position: { x: r.x, y: r.y },
    width: w,
    height: h,
    zIndex: AREA_Z,
    dragHandle: ".area-title",
    data: { title } satisfies AreaData,
  };
}

/** An area's size: what was set on it, or what the board measured. */
export function areaSize(n: Node) {
  return { w: n.width ?? n.measured?.width ?? 0, h: n.height ?? n.measured?.height ?? 0 };
}

/** Something on the board with a size, in board units. */
export type Thing = { id: string; type: string } & Rect;

const snapUp = (v: number, g: number) => Math.ceil(v / g - 1e-9) * g;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** A thing belongs to an area when its centre is inside the area's rectangle. */
export function insideArea(area: Rect, thing: Rect) {
  return contains(area, center(thing));
}

/** An area around some rects, on the grid, with at least one grid unit of room on every side. */
export function areaAround(rects: Rect[], grid: number): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const x = Math.floor((x0 - grid) / grid) * grid + 0;
  const y = Math.floor((y0 - grid) / grid) * grid + 0;
  return { x, y, w: snapUp(x1 + grid, grid) - x, h: snapUp(y1 + grid, grid) - y };
}

/** Which area each thing belongs to: the smallest area its centre is inside. */
export function areaOwners(nodes: Thing[]) {
  const areas = nodes.filter((n) => n.type === "area").sort((a, b) => a.w * a.h - b.w * b.h || byId(a, b));
  const owner = new Map<string, string>();
  for (const n of nodes) {
    if (n.type === "area") continue;
    const a = areas.find((r) => insideArea(r, n));
    if (a) owner.set(n.id, a.id);
  }
  return owner;
}

/** Top to bottom in rows, left to right within a row: the order you'd read them in. */
function readingOrder(ns: Thing[]) {
  const sorted = [...ns].sort((a, b) => a.y - b.y || a.x - b.x || byId(a, b));
  const rows: Thing[][] = [];
  let bottom = -Infinity;
  for (const n of sorted) {
    if (rows.length && n.y + n.h / 2 < bottom) {
      rows[rows.length - 1].push(n);
      bottom = Math.max(bottom, n.y + n.h);
    } else {
      rows.push([n]);
      bottom = n.y + n.h;
    }
  }
  return rows.flatMap((r) => r.sort((a, b) => a.x - b.x || byId(a, b)));
}

/** Lays an area's members out in rows inside it, about as wide as the area was. */
export function packArea(area: Thing, members: Thing[], grid: number, gap: number) {
  const block = { w: area.w, h: area.h, members: [] as { id: string; dx: number; dy: number }[] };
  if (!members.length) return block;
  const pad = grid;
  // About as wide as the area was: a row may run one gap wider, since the gaps here may be wider than the user's.
  const inner = Math.max(area.w - 2 * pad, ...members.map((m) => m.w)) + gap;
  let x = 0;
  let y = 0;
  let rowH = 0;
  let right = 0;
  for (const m of readingOrder(members)) {
    if (x > 0 && x + m.w > inner) {
      y = snapUp(y + rowH + gap, grid);
      x = 0;
      rowH = 0;
    }
    block.members.push({ id: m.id, dx: pad + x, dy: pad + y });
    right = Math.max(right, x + m.w);
    rowH = Math.max(rowH, m.h);
    x = snapUp(x + m.w + gap, grid);
  }
  block.w = snapUp(right + 2 * pad, grid);
  block.h = snapUp(y + rowH + 2 * pad, grid);
  return block;
}
