// A sample project used while designing: a made-up client, with research
// already sorted into stacks and connected. The images in public/sample are
// drawn by scripts/sample-art.mjs; the live card's component is
// public/live/hello.html.

import type { Edge, Node } from "@xyflow/react";
import type { Item } from "./types";

const img = (id: string, w: number, h: number, title?: string): Item => ({
  id,
  kind: "image",
  src: `/sample/${id}.jpg`,
  w,
  h,
  title,
});

const blueWhite = [
  img("0bbf2964", 300, 300, "Blue triangle"),
  img("9bea50dd", 267, 300, "Blueprint"),
  img("3ee1bced", 240, 300),
  img("7963b716", 400, 225),
  img("3d157743", 225, 300),
  img("9bd354f5", 400, 265),
];

const minimalUi = [
  img("9dc3d214", 225, 300, "Soft stacked shapes"),
  img("2e65e758", 300, 300),
  img("a2af8454", 400, 298, "Pipeline dashboard"),
  img("ccc3a7b5", 400, 284),
  img("3f1951a8", 241, 300),
];

const type = [
  img("9d024b2b", 400, 225, "Letter A"),
  img("67fce8d8", 300, 300),
  img("e9fe5182", 300, 300),
  img("8866bb5d", 400, 225),
];

const packaging = [
  img("35515d79", 400, 300, "Bar wrapper"),
  img("cd067aa2", 240, 300),
  img("0cadf925", 240, 300),
  img("074f85be", 225, 300),
  img("d3a28eb4", 142, 300),
];

export const sampleNodes: Node[] = [
  {
    id: "project",
    type: "project",
    position: { x: -170, y: -80 },
    data: {
      title: "Northwind",
      brief: "AI shopping assistant for small brands. New site and brand, launch in spring.",
    },
  },
  {
    id: "note-founders",
    type: "note",
    position: { x: -760, y: -300 },
    data: {
      text: "Founders call, 20 Oct\n\nThey want it calm and trustworthy. Blue and white keeps coming up. They hate busy dashboards.",
    },
  },
  {
    id: "note-audience",
    type: "note",
    position: { x: -760, y: 160 },
    data: {
      text: "Who buys\n\nSmall brand owners, 28 to 40. Run the shop from their phone. They buy on trust.",
    },
  },
  { id: "stack-blue", type: "stack", position: { x: 480, y: -400 }, data: { title: "Blue and white", items: blueWhite } },
  { id: "stack-ui", type: "stack", position: { x: 560, y: 60 }, data: { title: "Minimal interfaces", items: minimalUi } },
  { id: "stack-type", type: "stack", position: { x: -110, y: -560 }, data: { title: "Typography", items: type } },
  { id: "stack-pack", type: "stack", position: { x: -60, y: 330 }, data: { title: "Packaging", items: packaging } },
  { id: "card-robot", type: "card", position: { x: 940, y: 470 }, data: { item: img("42cd816b", 300, 300, "Round robot") } },
  { id: "card-robot-2", type: "card", position: { x: 1150, y: 520 }, data: { item: img("f87f60b0", 300, 300, "Robot in lift") } },
  { id: "card-bunny", type: "card", position: { x: 1040, y: 760 }, data: { item: img("87668d1c", 300, 300, "Bunny") } },
  {
    id: "card-live",
    type: "card",
    position: { x: 1024, y: 64 },
    data: { item: { id: "live-hello", kind: "live", src: "/live/hello.html", title: "Soft follow", w: 640, h: 400 } },
  },
];

const link = (id: string, source: string, target: string, note?: string): Edge => ({
  id,
  source,
  target,
  type: "link",
  data: note ? { note } : {},
});

export const sampleEdges: Edge[] = [
  link("e1", "project", "note-founders"),
  link("e2", "project", "note-audience"),
  link("e3", "note-founders", "stack-blue", "They like blue and white"),
  link("e4", "note-founders", "stack-ui", "No busy dashboards"),
  link("e5", "project", "stack-type"),
  link("e6", "note-audience", "stack-pack", "Buy on trust: real product shots"),
  link("e7", "project", "stack-ui"),
  link("e8", "stack-ui", "card-live", "Motion that stays calm"),
];
