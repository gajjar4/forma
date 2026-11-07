// Where the home screen's boards come from, and how one is opened or made.
// In the app: folders on this Mac. In a browser: see dev.ts.

import { convertFileSrc } from "@tauri-apps/api/core";
import { mkdir, readDir, readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { makeSample, pickFolder, projectsHome, recentProjects } from "../app/projects";
import { parseBoard, serialize, type Board } from "../model/format";
import type { ProjectData } from "../model/types";
import { BOARD_FILE, emptyBoard, folderName, folderStore, join } from "../store/folder";
import type { BoardStore } from "../store/types";
import { folderNameFor, orderBoards, summarize, type BoardSummary } from "./summary";

export type Opened = { store: BoardStore; board: Board };

export interface HomeSource {
  /** Every board there is, most recently edited first. */
  list(): Promise<BoardSummary[]>;
  open(root: string): Promise<Opened>;
  /** Makes a new board named `name` and opens it. */
  create(name: string): Promise<Opened>;
  /** Asks for a folder somewhere else and opens it. Null when nothing was picked. */
  pick(): Promise<Opened | null>;
  /** The sample board, for a Mac with no boards yet. */
  sample(): Promise<Opened>;
}

/** One folder's board as the home shows it. Null when there is no board there to read. */
async function readSummary(root: string): Promise<BoardSummary | null> {
  try {
    const path = join(root, BOARD_FILE);
    const [text, info] = await Promise.all([readTextFile(path), stat(path)]);
    const board = parseBoard(text, (file) => convertFileSrc(join(root, file)));
    return board ? summarize(board, root, folderName(root), info.mtime?.getTime() ?? null) : null;
  } catch {
    return null;
  }
}

/** The folders directly inside Documents/Forma, by name. */
async function homeFolders(home: string): Promise<string[]> {
  try {
    return (await readDir(home)).filter((e) => e.isDirectory && !e.name.startsWith(".")).map((e) => e.name);
  } catch {
    return [];
  }
}

const open = async (root: string): Promise<Opened> => {
  const store = folderStore(root);
  return { store, board: await store.load() };
};

export const appSource: HomeSource = {
  async list() {
    const home = await projectsHome();
    // Boards in Documents/Forma, and any opened from elsewhere (a folder that's gone is skipped).
    const roots = new Set([...(await homeFolders(home)).map((name) => join(home, name)), ...recentProjects()]);
    const found = await Promise.all([...roots].map(readSummary));
    return orderBoards(found.filter((b): b is BoardSummary => !!b));
  },
  open,
  async create(name) {
    const home = await projectsHome();
    await mkdir(home, { recursive: true });
    const taken = (await readDir(home)).map((e) => e.name);
    const root = join(home, folderNameFor(name, taken));
    await mkdir(root);
    // The board is called what was typed; the folder only had to be a safe name for it.
    const board = emptyBoard(root);
    const project = board.nodes[0];
    project.data = { ...(project.data as ProjectData), title: name.trim() || folderName(root) };
    await writeTextFile(join(root, BOARD_FILE), serialize(board));
    return open(root);
  },
  async pick() {
    const root = await pickFolder("Open a folder as a board");
    return root ? open(root) : null;
  },
  async sample() {
    return open(await makeSample());
  },
};
