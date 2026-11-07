// Where grid dots are wanted right now: a "+" at each port of the thing under
// the pointer, one where a drag from outside would land, and a line of dots
// along the wire being pulled. Read from React Flow's store and the
// grid-effect state on every frame; no React involved.

import type { InternalNode, ReactFlowState } from "@xyflow/react";
import { wirePath } from "../model/geometry";
import { portCentreOf } from "./body";
import { labelZoom } from "./zoom";
import { dotStyle, GRID } from "./dots";
import type { GridFxState } from "./gridFx";
import { cubicFromPath, plusOffsets, sampleEvenly, SIDES, type Side } from "./gridFx.math";
import { FOLLOW, GATHER, type Env, type Want } from "./gridFx.swarm";

/** Half the port's hit area: a wire starts this far out from the edge, at the "+"'s centre. */
export const PORT_OUT = 10;

// Spacing in screen px. Gathered dots are a touch larger than the grid's own
// at this zoom, within a few px either way so the glyphs stay crisp.
const ARM = 5.5;
const ACTIVE = 1.3;
const WIRE_STEP = 11;
const WIRE_START = 16.5;
const sizes = (zoom: number) => {
  const g = dotStyle(zoom).size;
  const plus = Math.min(3.2, Math.max(2.2, g * 1.4));
  const wire = Math.min(3, Math.max(2, g * 1.3));
  return { plus, wire, head: wire * 1.3 };
};
/** How far a dot may come from to join, in screen px (or one and a half grid steps, if more). */
const REACH = 120;

const BACK: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

function rectOf(n: InternalNode) {
  const { x, y } = n.internals.positionAbsolute;
  return { x, y, w: n.measured.width ?? 0, h: n.measured.height ?? 0 };
}

function addPlus(wants: Map<string, Want>, id: string, side: Side, centre: { x: number; y: number }, active: boolean, zoom: number, order: number) {
  const scale = active ? ACTIVE : 1;
  const px = 1 / zoom;
  plusOffsets(ARM * scale * px).forEach((o, i) => {
    wants.set(`p:${id}:${side}:${i}`, {
      x: centre.x + o.x,
      y: centre.y + o.y,
      size: sizes(zoom).plus * (active ? 1.25 : 1),
      boost: active ? 4 : 2.6,
      spring: GATHER,
      delay: order * 0.018 + i * 0.022,
    });
  });
}

/** Everything the dots should be doing this frame, keyed so each dot keeps its job. */
export function sceneWants(s: ReactFlowState, fx: GridFxState): Map<string, Want> {
  const zoom = s.transform[2] || 1;
  const px = 1 / zoom;
  const wants = new Map<string, Want>();
  const conn = s.connection;
  const from = conn.inProgress ? conn.fromNode : null;
  const fromSide = conn.inProgress ? (conn.fromPosition as Side | null) : null;

  const hovered = fx.hover ? s.nodeLookup.get(fx.hover) : undefined;
  // A wire pulled close enough to a port is caught by it (React Flow's
  // connection radius). That port's "+" doesn't stay a "+": its dots become
  // the end of the wire.
  const caught =
    conn.inProgress && conn.toHandle && conn.toNode && conn.toNode.id !== from?.id
      ? { node: conn.toNode.id, side: conn.toHandle.position as Side }
      : null;

  if (hovered && !hovered.dragging && !hovered.hidden && hovered.id !== from?.id) {
    SIDES.forEach((side, order) => {
      if (caught && caught.node === hovered.id && caught.side === side) return;
      const active = fx.port?.node === hovered.id && fx.port.side === side;
      // Clear of the thing's title and, on a stack, of its fanned cards (body.ts).
      addPlus(wants, hovered.id, side, portCentreOf(hovered, side, labelZoom(), PORT_OUT), active, zoom, order);
    });
  }

  // Something dragged in from outside: a "+" on the dot where it would land.
  if (fx.drop) addPlus(wants, "drop", "top", fx.drop, false, zoom, 0);

  if (conn.inProgress && from && fromSide) {
    // The port you pulled from stays lit, and the wire runs out of its centre.
    addPlus(wants, from.id, fromSide, conn.from, true, zoom, 0);
    const to = { x: (conn.to.x - s.transform[0]) * px, y: (conn.to.y - s.transform[1]) * px };
    const toSide = caught ? caught.side : BACK[fromSide];
    const { path } = wirePath({ ...conn.from, side: fromSide }, { ...to, side: toSide });
    const curve = cubicFromPath(path);
    if (curve) {
      // A wire dot stays within a few grid squares of its home. Further than
      // that, it heads home and the most relevant dot takes its place: a free
      // grid dot nearby, or one still on its way home that can turn around.
      const handoff = Math.max(GRID * 2.5, 40 * px);
      const size = sizes(zoom);
      const pts = sampleEvenly(curve, WIRE_STEP * px, WIRE_START * px);
      // When caught, the last five dots of the wire are the caught "+"'s own
      // dots (same keys), so the "+" visibly melts into the line.
      const melt = caught ? Math.min(5, pts.length) : 0;
      pts.forEach((p, k) => {
        const head = k === pts.length - 1;
        const fromEnd = pts.length - 1 - k;
        const key =
          caught && fromEnd < melt ? `p:${caught.node}:${caught.side}:${fromEnd}` : head ? "w:head" : `w:${k}`;
        wants.set(key, {
          x: p.x,
          y: p.y,
          size: head ? size.head : size.wire,
          boost: head ? 4 : 3,
          spring: FOLLOW,
          handoff,
        });
      });
    }
  }
  return wants;
}

/** The swarm's view of the board this frame. `grid` and `borrow` come from the grid's own style. */
export function sceneEnv(s: ReactFlowState, grid: number, gridAlpha: number, reduced: boolean): Env {
  const zoom = s.transform[2] || 1;
  let rects: { x: number; y: number; w: number; h: number }[] | null = null;
  const pad = 3 / zoom;
  return {
    grid,
    reach: Math.max(REACH / zoom, 1.5 * grid),
    borrow: gridAlpha > 0.6,
    reduced,
    px: 1 / zoom,
    blocked(i, j) {
      rects ??= [...s.nodeLookup.values()].filter((n) => !n.hidden).map(rectOf);
      const x = i * grid;
      const y = j * grid;
      return rects.some((r) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
    },
  };
}
