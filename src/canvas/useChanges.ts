import { useReactFlow, useStoreApi, type Edge, type Node } from "@xyflow/react";
import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import type { Board } from "../model/format";
import type { BoardStore } from "../store/types";
import type { StackData } from "../model/types";
import { diffBoards, keepMeasured, prints, readPrints, remember, unseen, type Prints, type Waiting } from "./changes";
import { ripple } from "./gridFx.ripple";
import { boardRectOf, drawWire, edgeEl, fadeOut, labelEl, nodeEl, pinSeen, placeSeen, seenLayer, settle, tileEl, unpinSeen, whenDrawn } from "./glow";
import "../styles/changes.css";

/** How long a thing that moved takes to glide to where it was put. */
const GLIDE_MS = 520;
/** More than this many moving at once just jump: a whole board re-sorted reads better that way. */
const GLIDE_MAX = 80;
/** The record of what was seen is written this long after the board settles. */
const WRITE_MS = 1200;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * What was last seen of each board is kept in this Mac's local storage, by
 * folder, never in the folder: the folder is the board you share with your
 * AI, and what you personally have looked at isn't part of it.
 */
const recordKey = (store: BoardStore) => `forma.seen.v1:${store.root ?? "browser"}`;

function load(key: string): Prints | null {
  try {
    return readPrints(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function keep(key: string, p: Prints) {
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    // Full or blocked: the board still works, it just can't say what's new next time.
  }
}

/**
 * Makes what your AI did visible. `arrive` is for the folder watcher: given
 * the board that just came in, what was added or changed settles in with the
 * dot grid rippling out from it, new wires draw themselves in, what was taken
 * away fades out, and it returns the board to show, with things that moved
 * still where they were so they can glide.
 *
 * Whatever your AI changed, now or while the board was closed, also keeps a
 * small dot until you have looked at it: pointed at it, or for a stack,
 * opened it (its new items then carry the dot inside, until pointed at).
 * Only being on screen never counts. Your own changes in the app never show.
 */
export function useChanges(store: BoardStore, nodes: Node[], edges: Edge[]) {
  const flow = useStoreApi();
  const { getNodes, getEdges, setNodes } = useReactFlow();
  const key = recordKey(store);
  /** What was last written down as seen. */
  const record = useRef<Prints | null>(null);
  /** What is marked as new and not looked at yet. */
  const waiting = useRef<Waiting>({ nodes: new Set(), wires: new Set(), items: new Set() });
  const writeTimer = useRef<number | undefined>(undefined);
  const glide = useRef(0);

  const write = useCallback(() => {
    window.clearTimeout(writeTimer.current);
    if (!record.current) return;
    record.current = remember(record.current, prints({ nodes: getNodes(), edges: getEdges() }), waiting.current);
    keep(key, record.current);
  }, [key, getNodes, getEdges]);
  const writeSoon = useCallback(() => {
    window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(write, WRITE_MS);
  }, [write]);

  /** A thing marked as new has been seen: its dot fades and it's remembered as it is. */
  const looked = useCallback(
    (el: HTMLElement) => {
      const id = el.dataset.id ?? el.dataset.wire;
      if (!id) return;
      unpinSeen(el);
      waiting.current.nodes.delete(id);
      waiting.current.wires.delete(id);
      waiting.current.items.delete(id);
      writeSoon();
    },
    [writeSoon],
  );


  // Opening the board: what changed since it was last seen stands out.
  const open = useEffectEvent(() => {
    const root = flow.getState().domNode;
    const seen = load(key);
    const board = { nodes, edges };
    record.current = seen ?? prints(board);
    // The first time a board is opened there is nothing to compare with.
    if (seen && root) {
      const fresh = unseen(seen, board);
      const areas = new Set(nodes.flatMap((n) => (n.type === "area" ? [n.id] : [])));
      for (const id of fresh.nodes) {
        if (areas.has(id)) continue;
        waiting.current.nodes.add(id);
        whenDrawn(() => nodeEl(root, id), pinSeen);
      }
      for (const id of fresh.items) waiting.current.items.add(id);
      for (const id of fresh.wires) {
        // New wires draw themselves in once the board has arrived.
        if (!(id in seen.wires)) whenDrawn(() => edgeEl(root, id), (el) => drawWire(el, 500));
        if (!edges.find((e) => e.id === id)?.data?.note) continue;
        waiting.current.wires.add(id);
        whenDrawn(() => labelEl(root, id), pinSeen);
      }
    }
    write();
  });

  useEffect(() => {
    const root = flow.getState().domNode;
    const stopLayer = root ? seenLayer(root) : () => {};
    // The dots follow the board as it pans and zooms.
    const stopMoves = flow.subscribe((s, prev) => {
      if (s.transform !== prev.transform) placeSeen();
    });
    window.addEventListener("resize", placeSeen);
    open();
    // Pointing at something marked as new counts as seeing it. Not a stack:
    // what changed is inside, so it counts once it's opened.
    const onOver = (e: PointerEvent) => {
      const lit = (e.target as Element | null)?.closest<HTMLElement>('[data-unseen="pinned"]');
      if (lit && !lit.classList.contains("react-flow__node-stack")) looked(lit);
    };
    const onHide = () => write();
    document.addEventListener("pointerover", onOver);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("resize", placeSeen);
      stopMoves();
      stopLayer();
      cancelAnimationFrame(glide.current);
      write();
    };
  }, [flow, looked, write]);

  // Anything you do on the board yourself counts as seen. And what you
  // moved takes its dot with it.
  useEffect(() => {
    writeSoon();
    placeSeen();
  }, [writeSoon, nodes, edges]);

  /** Glides the things in `paths` from where they were to where they were put. */
  const glideTo = useCallback(
    (paths: Map<string, { from: Node["position"]; to: Node["position"] }>) => {
      cancelAnimationFrame(glide.current);
      const t0 = performance.now();
      const step = (now: number) => {
        const e = easeOutCubic(Math.min(1, (now - t0) / GLIDE_MS));
        setNodes((ns) =>
          ns.map((n) => {
            const p = paths.get(n.id);
            return p ? { ...n, position: { x: p.from.x + (p.to.x - p.from.x) * e, y: p.from.y + (p.to.y - p.from.y) * e } } : n;
          }),
        );
        if (e < 1) glide.current = requestAnimationFrame(step);
      };
      glide.current = requestAnimationFrame(step);
    },
    [setNodes],
  );

  /** A stack was opened: it has been seen, and its new items show the dot inside. */
  const opened = useCallback(
    (stackId: string) => {
      const root = flow.getState().domNode;
      const el = root && nodeEl(root, stackId);
      if (el) unpinSeen(el);
      waiting.current.nodes.delete(stackId);
      const stack = getNodes().find((n) => n.id === stackId);
      if (stack?.type === "stack") {
        for (const { id } of (stack.data as StackData).items) {
          if (waiting.current.items.has(id)) whenDrawn(() => tileEl(id), pinSeen);
        }
      }
      writeSoon();
    },
    [flow, getNodes, writeSoon],
  );

  /** A stack was closed: everything in it has been seen. */
  const closed = useCallback(
    (stackId: string) => {
      const stack = getNodes().find((n) => n.id === stackId);
      if (stack?.type === "stack") for (const { id } of (stack.data as StackData).items) waiting.current.items.delete(id);
      writeSoon();
    },
    [getNodes, writeSoon],
  );

  const arrive = useCallback(
    (board: Board): Board => {
      const root = flow.getState().domNode;
      const before = { nodes: getNodes(), edges: getEdges() };
      if (!root) return board;
      const d = diffBoards(before, board);
      const areas = new Set(board.nodes.flatMap((n) => (n.type === "area" ? [n.id] : [])));
      // Away from the window (another app in front, or minimised), it just
      // waits with its dot, like changes made while the board was closed.
      const away = document.hidden;
      const fresh = new Set([...d.added, ...d.wires.added]);
      // Seen as it happens: the grid ripples out from it, a new thing settles
      // in, and it keeps its dot until you have looked at it.
      const light = (el: HTMLElement) => {
        pinSeen(el);
        if (away) return;
        if (fresh.has(el.dataset.id ?? el.dataset.wire ?? "")) settle(el);
        if (!reduced()) ripple(boardRectOf(el, root, flow.getState().transform));
      };

      for (const id of d.removed) fadeOut(nodeEl(root, id));
      for (const id of [...d.added, ...d.changed]) {
        if (areas.has(id)) continue;
        waiting.current.nodes.add(id);
        whenDrawn(() => nodeEl(root, id), light);
      }
      const stacked = new Set(board.nodes.flatMap((n) => (n.type === "stack" ? (n.data as StackData).items.map((i) => i.id) : [])));
      for (const id of [...d.items.added, ...d.items.changed]) if (stacked.has(id)) waiting.current.items.add(id);
      for (const id of d.wires.added) whenDrawn(() => edgeEl(root, id), (el) => drawWire(el));
      const noted = new Set(board.edges.flatMap((e) => (e.data?.note ? [e.id] : [])));
      for (const id of [...d.wires.added, ...d.wires.changed]) {
        if (!noted.has(id)) continue;
        waiting.current.wires.add(id);
        whenDrawn(() => labelEl(root, id), light);
      }
      writeSoon();

      // Things that moved arrive where they were, then glide to their new place.
      const was = new Map(before.nodes.map((n) => [n.id, n]));
      const paths = new Map(
        d.moved.flatMap((id) => {
          const to = board.nodes.find((n) => n.id === id)?.position;
          const from = was.get(id)?.position;
          return to && from ? [[id, { from, to }] as const] : [];
        }),
      );
      const glides = paths.size > 0 && paths.size <= GLIDE_MAX && !reduced();
      if (glides) glideTo(paths);
      // What didn't change stays the very same object, so React Flow only
      // draws again what did (and keeps what you had selected). What did
      // change keeps its measured size, so React Flow doesn't hide and
      // measure it, and its wires, all over again.
      const touched = new Set([...d.added, ...d.changed, ...d.moved]);
      const wired = new Set([...d.wires.added, ...d.wires.changed]);
      const wiresWere = new Map(before.edges.map((e) => [e.id, e]));
      return {
        nodes: board.nodes.map((n) => {
          const old = was.get(n.id);
          const p = glides ? paths.get(n.id) : undefined;
          if (p) return { ...keepMeasured(n, old), position: p.from };
          return touched.has(n.id) ? keepMeasured(n, old) : (old ?? n);
        }),
        edges: board.edges.map((e) => (wired.has(e.id) ? e : (wiresWere.get(e.id) ?? e))),
      };
    },
    [flow, getNodes, getEdges, glideTo, writeSoon],
  );

  return { arrive, opened, closed };
}
