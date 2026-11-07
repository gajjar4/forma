import {
  addEdge,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
} from "@xyflow/react";
import { startTransition, useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { newId, patchItem, reorderStack, takeOut } from "../model/operations";
import type { Board } from "../model/format";
import type { CardData, Item, StackData } from "../model/types";
import type { BoardStore } from "../store/types";
import { Toolbar, type Tool } from "../chrome/Toolbar";
import { ZoomPill } from "../chrome/ZoomPill";
import { FocusView } from "../focus/FocusView";
import { Search } from "../search/SearchPanel";
import { rectOf } from "../focus/Lift";
import { CanvasUiContext } from "./context";
import { DotGrid } from "./DotGrid";
import { EmptyHint } from "./EmptyHint";
import { onlyProject } from "./hint";
import { GRID, snapToDots } from "./dots";
import { hoverNode, leaveNode, trackPointer } from "./gridFx";
import { ConnectionLine } from "./edges/ConnectionLine";
import { LinkEdge } from "./edges/LinkEdge";
import { holdLive } from "./live/runner";
import { LiveView, type OpenLive } from "./live/LiveView";
import { AreaNode } from "./nodes/AreaNode";
import { CardNode } from "./nodes/CardNode";
import { NoteNode } from "./nodes/NoteNode";
import { ProjectNode } from "./nodes/ProjectNode";
import { StackNode } from "./nodes/StackNode";
import { useAreas } from "./useAreas";
import { useChanges } from "./useChanges";
import { useDrop } from "./useDrop";
import { usePaste } from "./usePaste";
import { useStacking } from "./useStacking";
import { useTidy } from "./useTidy";
import { useSnapTicks } from "./useSnapTicks";
import { useUndo } from "./useUndo";
import { detailShows } from "./zoom";

/** Quick to start, gentle to land: how the board glides in to something. */
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const nodeTypes = { project: ProjectNode, stack: StackNode, card: CardNode, note: NoteNode, area: AreaNode };
const edgeTypes = { link: LinkEdge };

function linkEdge(source: string, target: string): Edge {
  return { id: newId("wire"), source, target, type: "link", data: {} };
}

/** True when a wire between these two already exists, either way round. */
function connected(edges: Edge[], a: string, b: string) {
  return edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));
}

type Props = { store: BoardStore; initial: Board };

export function Canvas({ store, initial }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { screenToFlowPosition, fitView, getNode, getZoom } = useReactFlow();
  const { dropTargetId, onNodeDrag, onNodeDragStop } = useStacking();
  const { commit } = useUndo();
  useSnapTicks(dropTargetId);
  const [tool, setTool] = useState<Tool>("select");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [live, setLive] = useState<OpenLive | null>(null);

  // An opened stack covers the board: its live cards rest meanwhile.
  useEffect(() => (focusId ? holdLive() : undefined), [focusId]);

  useEffect(() => store.save({ nodes, edges }), [store, nodes, edges]);
  const { arrive, opened, closed } = useChanges(store, nodes, edges);
  // Opening a stack shows what's new inside it; closing it counts it all seen.
  const openStack = useCallback(
    (id: string) => {
      setFocusId(id);
      opened(id);
    },
    [opened],
  );
  const closeStack = useCallback(() => {
    if (focusId) closed(focusId);
    setFocusId(null);
  }, [closed, focusId]);

  // Someone else changed the board (an AI, an editor): show it, and let ⌘Z take it back.
  useEffect(
    () =>
      store.watch((board) => {
        commit();
        const shown = arrive(board);
        startTransition(() => {
          setNodes(shown.nodes);
          setEdges(shown.edges);
        });
      }),
    [store, commit, arrive, setNodes, setEdges],
  );

  const onConnect: OnConnect = useCallback(
    (c) => {
      if (c.source === c.target) return;
      commit();
      setEdges((es) => (connected(es, c.source, c.target) ? es : addEdge(linkEdge(c.source, c.target), es)));
    },
    [commit, setEdges],
  );

  // Let a wire land anywhere on a thing, not only on one of its ports.
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (state.isValid || !state.fromNode) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const el = document.elementFromPoint(point.clientX, point.clientY)?.closest(".react-flow__node");
      const to = el?.getAttribute("data-id");
      const from = state.fromNode.id;
      // Areas never take wires.
      if (!to || to === from || getNode(to)?.type === "area") return;
      commit();
      setEdges((es) => (connected(es, from, to) ? es : [...es, linkEdge(from, to)]));
    },
    [commit, getNode, setEdges],
  );

  // Clicking a stack opens it, and so does clicking a card on the board
  // that has more to show (a picture, a video, a document or a live card),
  // big. None is selected, so nothing is left highlighted when you close it
  // again. Anything else clicked from too far away to read glides the board
  // in to it, so a click always does something.
  const onNodeClick = useCallback(
    (e: ReactMouseEvent, node: Node) => {
      const kind = node.type === "card" ? (node.data as CardData).item.kind : null;
      const opens = node.type === "stack" || kind === "live" || kind === "image" || kind === "video" || kind === "doc";
      if (!opens) {
        if (!detailShows(getZoom(), false)) {
          const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          fitView({ nodes: [{ id: node.id }], maxZoom: 1, padding: 0.6, duration: reduced ? 0 : 640, ease: easeOutCubic });
        }
        return;
      }
      setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)));
      if (node.type === "stack") return openStack(node.id);
      const media = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".card-media");
      if (media) setLive((l) => l ?? { id: node.id, item: (node.data as CardData).item, from: rectOf(media) });
    },
    [fitView, getZoom, openStack, setNodes],
  );

  const centre = useCallback(
    () => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    [screenToFlowPosition],
  );

  const addNote = useCallback(() => {
    const p = centre();
    commit();
    setNodes((ns) => [
      ...ns.map((n) => ({ ...n, selected: false })),
      { id: newId("note"), type: "note", position: snapToDots({ x: p.x - 130, y: p.y - 60 }), selected: true, data: { text: "New note\n\nDouble-click to write." } },
    ]);
  }, [centre, commit, setNodes]);

  const addImages = useCallback(
    async (files: File[], source?: string) => {
      const p = centre();
      const read = await Promise.allSettled(files.map((f) => store.importMedia(f, source)));
      const items = read.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      if (!items.length) return;
      commit();
      setNodes((ns) => [
        ...ns,
        ...items.map((item, i) => ({
          id: newId("card"),
          type: "card",
          position: snapToDots({ x: p.x - 90 + i * GRID, y: p.y - 90 + i * GRID }),
          data: { item },
        })),
      ]);
    },
    [centre, commit, setNodes, store],
  );

  usePaste({ enabled: !focusId && !live, centre, commit, onImages: addImages });
  const dropOver = useDrop({ store, commit, enabled: !focusId && !live });
  const areas = useAreas({ commit, centre });
  const tidyUp = useTidy(commit);

  const focused = nodes.find((n) => n.id === focusId && n.type === "stack");

  const onTakeOut = useCallback(
    (itemId: string) => {
      if (!focused) return;
      const at = snapToDots({ x: focused.position.x + 260, y: focused.position.y + 40 });
      commit();
      const next = takeOut({ nodes, edges }, focused.id, itemId, at);
      setNodes(next.nodes);
      setEdges(next.edges);
      if (!next.nodes.some((n) => n.id === focused.id)) setFocusId(null);
    },
    [commit, edges, focused, nodes, setEdges, setNodes],
  );

  const onReorder = useCallback(
    (itemIds: string[]) => {
      if (!focusId) return;
      commit();
      setNodes((ns) => reorderStack({ nodes: ns, edges: [] }, focusId, itemIds).nodes);
    },
    [commit, focusId, setNodes],
  );

  const updateItem = useCallback(
    (itemId: string, patch: Partial<Item>) => {
      commit();
      setNodes((ns) => patchItem(ns, itemId, patch));
    },
    [commit, setNodes],
  );
  const ui = useMemo(
    () => ({ dropTargetId: dropTargetId ?? dropOver, commit, liveId: live?.id ?? null, updateItem, root: store.root }),
    [dropTargetId, dropOver, commit, live?.id, updateItem, store.root],
  );

  return (
    <CanvasUiContext.Provider value={ui}>
      <div className="board" data-tool={tool} onPointerMove={trackPointer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={(changes: NodeChange[]) => onNodesChange(areas.filterChanges(changes))}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(e, n) => n.type !== "area" && hoverNode(e, n)}
          onNodeMouseLeave={leaveNode}
          onNodeDragStart={(e, n, ns) => {
            commit();
            areas.onDragStart(e, n, ns);
          }}
          onNodeDrag={(e, n, ns) => {
            onNodeDrag(e, n, ns);
            areas.onDrag(e, n, ns);
          }}
          onNodeDragStop={(e, n, ns) => {
            onNodeDragStop(e, n, ns);
            areas.onDragStop(e, n, ns);
          }}
          onSelectionStart={areas.onSelectionStart}
          onSelectionEnd={areas.onSelectionEnd}
          onBeforeDelete={async () => {
            commit();
            return true;
          }}
          connectionMode={ConnectionMode.Loose}
          connectionLineComponent={ConnectionLine}
          connectionRadius={72}
          defaultEdgeOptions={{ type: "link" }}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          panOnDrag={tool === "hand" ? true : [1]}
          selectionOnDrag={tool === "select"}
          selectionMode={SelectionMode.Partial}
          snapToGrid
          snapGrid={[GRID, GRID]}
          nodeDragThreshold={3}
          minZoom={0.1}
          // Past 200% WebKit stretches the board's cached raster (it never
          // re-renders a layer for a transform's scale), so text goes soft.
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          proOptions={{ hideAttribution: true }}
        >
          <DotGrid />
          <EmptyHint board={store.root ?? "browser"} root={store.root} projectId={nodes[0]?.id ?? ""} bare={onlyProject(nodes)} />
        </ReactFlow>
        <Toolbar
          tool={tool}
          onTool={setTool}
          onNote={addNote}
          onImages={addImages}
          onArea={areas.addArea}
          onTidy={tidyUp}
          onFit={() => fitView({ padding: 0.18, duration: 500 })}
        />
        <ZoomPill />
        <Search enabled={!focusId && !live} onOpenStack={openStack} />
        <FocusView
          stack={focused ? { id: focused.id, ...(focused.data as StackData) } : null}
          onClose={closeStack}
          onTakeOut={onTakeOut}
          onReorder={onReorder}
        />
        <LiveView open={live} onDone={() => setLive(null)} />
      </div>
    </CanvasUiContext.Provider>
  );
}
