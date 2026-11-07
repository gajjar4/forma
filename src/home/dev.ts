// The home screen in a browser, for design work only (http://localhost:1420/?home,
// ?home=empty for a Mac with no boards, ?home=many for one that scrolls). There are no folders here: the
// browser's own board comes first, then a few made-up boards drawn from
// public/sample, and every one of them opens the browser board. The Mac app
// never uses this.

import type { Item } from "../model/types";
import { browserStore } from "../store/browser";
import type { HomeSource, Opened } from "./source";
import { summarize, type BoardSummary } from "./summary";

const img = (id: string, w: number, h: number): Item => ({ id, kind: "image", src: `/sample/${id}.jpg`, w, h });
const note = (id: string, text: string): Item => ({ id, kind: "note", text });
const DAY = 86_400_000;

/** Made-up boards: pictures, notes only, and a new empty one. */
function madeUp(now: number): BoardSummary[] {
  const board = (root: string, name: string, count: number, faces: Item[], ago: number): BoardSummary => ({
    root: `dev:${root}`,
    name,
    count,
    faces,
    edited: now - ago * DAY,
  });
  return [
    board("havn", "HAVN packaging", 31, [img("35515d79", 400, 300), img("cd067aa2", 240, 300), img("0cadf925", 240, 300), img("074f85be", 225, 300)], 1),
    board("type", "Type studies", 12, [img("9d024b2b", 400, 225), img("67fce8d8", 300, 300), img("e9fe5182", 300, 300)], 4),
    board("dash", "Quiet dashboards", 46, [img("a2af8454", 400, 298), img("9dc3d214", 225, 300), img("ccc3a7b5", 400, 284), img("2e65e758", 300, 300)], 9),
    board(
      "interviews",
      "Interviews",
      7,
      [note("n1", "Maya, 24 Oct\n\nShe checks stock on her phone first thing."), note("n2", "Sam\n\nTrust before features."), note("n3", "Ola\n\nNever reads the dashboard.")],
      38,
    ),
    board("robots", "Robot friends", 3, [img("42cd816b", 300, 300), img("f87f60b0", 300, 300), img("87668d1c", 300, 300)], 70),
    board("fresh", "Spring launch", 0, [], 0.2),
  ];
}

const openBrowser = async (): Promise<Opened> => {
  const store = browserStore();
  return { store, board: await store.load() };
};

export function devSource(mode: string): HomeSource {
  return {
    async list() {
      if (mode === "empty") return [];
      const { board } = await openBrowser();
      const now = Date.now();
      const more = mode === "many" ? [1, 2, 3].flatMap((k) => madeUp(now - k * 40 * DAY).map((b) => ({ ...b, root: `${b.root}-${k}` }))) : [];
      return [summarize(board, "browser", "Sample board", now), ...madeUp(now), ...more];
    },
    open: openBrowser,
    create: openBrowser,
    pick: async () => null,
    sample: openBrowser,
  };
}
