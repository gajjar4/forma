import { useReactFlow, type Node, type NodeChange } from "@xyflow/react";
import { useCallback, useRef } from "react";
import { areaAround, areaNode, areaSize, insideArea, newId, NEW_AREA } from "../model/operations";
import type { Rect } from "../model/stacking";
import { GRID, snapToDots } from "./dots";
import { nameOnOpen } from "./nodes/AreaNode";

type Point = { x: number; y: number };
/** While an area is dragged: where each area started, and what rides along with which area. */
type Ride = { starts: Map<string, Point>; riders: Map<string, { area: string; at: Point }> };

/** A fresh area with nothing selected: twelve by eight dots, in the middle of the view. */
const DEFAULT = { w: 12 * GRID, h: 8 * GRID };

type Options = { commit: () => void; centre: () => Point };

/**
 * Areas: make one (around the selection, or empty in the middle of the view),
 * and carry everything inside an area along when it moves. A thing is inside
 * when its centre is inside the area as the drag starts.
 */
export function useAreas({ commit, centre }: Options) {
  const { getNodes, getInternalNode, setNodes } = useReactFlow();
  const ride = useRef<Ride | null>(null);
  const marquee = useRef(false);

  const rectOf = useCallback(
    (n: Node): Rect => {
      if (n.type === "area") return { ...n.position, ...areaSize(n) };
      const m = getInternalNode(n.id)?.measured ?? n.measured ?? {};
      return { ...n.position, w: m.width ?? 0, h: m.height ?? 0 };
    },
    [getInternalNode],
  );

  const addArea = useCallback(() => {
    const picked = getNodes().filter((n) => n.selected);
    let rect: Rect;
    if (picked.length) rect = areaAround(picked.map(rectOf), GRID);
    else {
      const c = centre();
      rect = { ...snapToDots({ x: c.x - DEFAULT.w / 2, y: c.y - DEFAULT.h / 2 }), ...DEFAULT };
    }
    const id = newId("area");
    nameOnOpen(id);
    commit();
    setNodes((ns) => [areaNode(id, rect, NEW_AREA), ...ns.map((n) => (n.selected ? { ...n, selected: false } : n))]);
  }, [centre, commit, getNodes, rectOf, setNodes]);

  const onDragStart = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      const areas = dragged.filter((n) => n.type === "area");
      if (!areas.length) {
        ride.current = null;
        return;
      }
      const moving = new Set(dragged.map((n) => n.id));
      const riders: Ride["riders"] = new Map();
      const all = getNodes();
      for (const a of areas) {
        const r = rectOf(a);
        for (const n of all) {
          if (moving.has(n.id) || riders.has(n.id) || !insideArea(r, rectOf(n))) continue;
          riders.set(n.id, { area: a.id, at: { ...n.position } });
        }
      }
      ride.current = { starts: new Map(areas.map((a) => [a.id, { ...a.position }])), riders };
    },
    [getNodes, rectOf],
  );

  const onDrag = useCallback(
    (_: unknown, __: Node, dragged: Node[]) => {
      const r = ride.current;
      if (!r?.riders.size) return;
      const now = new Map(dragged.map((n) => [n.id, n.position]));
      setNodes((ns) =>
        ns.map((n) => {
          const rider = r.riders.get(n.id);
          const to = rider && now.get(rider.area);
          if (!rider || !to) return n;
          const from = r.starts.get(rider.area)!;
          const x = rider.at.x + to.x - from.x;
          const y = rider.at.y + to.y - from.y;
          return x === n.position.x && y === n.position.y ? n : { ...n, position: { x, y } };
        }),
      );
    },
    [setNodes],
  );

  const onDragStop = useCallback(
    (e: unknown, node: Node, dragged: Node[]) => {
      onDrag(e, node, dragged);
      ride.current = null;
    },
    [onDrag],
  );

  // A selection box picks the things on an area, not the area itself: an area
  // is picked by its name.
  const onSelectionStart = useCallback(() => {
    marquee.current = true;
  }, []);
  const onSelectionEnd = useCallback(() => {
    marquee.current = false;
  }, []);
  const filterChanges = useCallback(
    (changes: NodeChange[]) => {
      if (!marquee.current) return changes;
      const areas = new Set(getNodes().flatMap((n) => (n.type === "area" ? [n.id] : [])));
      return changes.filter((c) => !(c.type === "select" && c.selected && areas.has(c.id)));
    },
    [getNodes],
  );

  return { addArea, onDragStart, onDrag, onDragStop, onSelectionStart, onSelectionEnd, filterChanges };
}
