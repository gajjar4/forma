// The board kept in a project folder on disk (the Mac app).
//
//   <project>/board.json   the board (see FORMAT.md)
//   <project>/media/       images, videos and documents
//   <project>/components/  live cards' components, one HTML file each
//
// Writes go to a temporary file first and are then renamed into place, so
// nothing (an AI, an editor, a crash) ever sees half a board. Changes made
// outside the app are picked up and shown live. Earlier versions are kept in
// the app's own data folder (keeper.ts), so a delete can be brought back.

import { convertFileSrc } from "@tauri-apps/api/core";
import { exists, mkdir, readTextFile, rename, watch, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { saveOnClose } from "../app/closing";
import { isDocFile } from "../model/docs";
import { parseBoard, serialize, type Board } from "../model/format";
import { newId } from "../model/operations";
import type { Item } from "../model/types";
import { importDocToFolder } from "./docs";
import { keeperFor } from "./keeper";
import { ensureSkill } from "./skill";
import { imageSize, newImageFields, titleFromName, type BoardStore } from "./types";
import { isVideoFile, videoStill } from "./videoStill";

export const BOARD_FILE = "board.json";
export const MEDIA_DIR = "media";
export const COMPONENTS_DIR = "components";

export const join = (...parts: string[]) => parts.join("/").replace(/\/+/g, "/");
export const folderName = (root: string) => root.replace(/\/+$/, "").split("/").pop() || "Project";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function extensionOf(file: File) {
  const fromName = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return fromName ?? EXT[file.type] ?? "jpg";
}

/** A brand-new board: just the project, named after its folder. */
export function emptyBoard(root: string): Board {
  return {
    nodes: [
      {
        id: "project",
        type: "project",
        position: { x: -170, y: -80 },
        data: { title: folderName(root), brief: "" },
      },
    ],
    edges: [],
  };
}

/** How to retire each folder's open store, when the same folder is opened again. */
const closers = new Map<string, () => void>();

export function folderStore(root: string): BoardStore {
  const boardPath = join(root, BOARD_FILE);
  // Not a dotfile: the app's file permissions ($HOME/**) don't match hidden
  // names, so a ".board.json.tmp" write was refused and nothing ever saved.
  const tmpPath = join(root, `${BOARD_FILE}.saving`);
  const resolve = (file: string) => convertFileSrc(join(root, file));

  // The last text we wrote or read. Lets us skip writes that change nothing
  // and ignore our own writes when the folder watcher reports them.
  let known = "";
  let timer: number | undefined;
  let pending: Board | null = null;
  /** Every write, one after another. Never rejects, so one failure doesn't stop the next. */
  let writing: Promise<void> = Promise.resolve();
  /** The board changed while open, by you or from outside: worth keeping as you leave it. */
  let changed = false;
  /** Told when the board on disk becomes another one (a change from outside, a restore). */
  let listener: ((board: Board) => void) | null = null;
  const keeper = keeperFor(root);

  /** Whole text into place, never half of it. */
  const put = async (text: string) => {
    known = text;
    await writeTextFile(tmpPath, text);
    await rename(tmpPath, boardPath);
  };

  /** Queues a write after any already going, and returns it (it rejects if the write failed). */
  const queue = (job: () => Promise<void>) => {
    const done = writing.then(job);
    writing = done.catch((e) => {
      // Forget what we think is on disk, so the next change retries the write.
      known = "";
      console.error("Could not save the board", e);
    });
    return done;
  };

  const write = async (board: Board) => {
    const text = serialize(board);
    if (text === known) return;
    const before = known;
    await put(text);
    changed = true;
    // The board as it was before this save, kept once it's written.
    void keeper.keep(before, "save");
  };

  /** Writes what's waiting now. Resolves once it's on disk. */
  const flush = () => {
    window.clearTimeout(timer);
    if (!pending) return writing;
    const board = pending;
    pending = null;
    return queue(() => write(board));
  };

  // Quitting writes what's waiting, and keeps the board as you left it, so a
  // change made while the app is closed can be undone too. A board opened
  // again takes over from its earlier store.
  closers.get(root)?.();
  const stop = saveOnClose(async (closing) => {
    await flush();
    if (closing && changed) await keeper.keep(known, "leave");
  });
  closers.set(root, () => {
    void flush();
    stop();
  });

  return {
    name: folderName(root),
    root,
    async load() {
      // The rules for an AI working here go in with every board (never over the user's own copy).
      void ensureSkill(root);
      if (await exists(boardPath)) {
        const text = await readTextFile(boardPath);
        const board = parseBoard(text, resolve);
        if (board) {
          known = text;
          return board;
        }
        throw new Error(`${BOARD_FILE} in ${folderName(root)} isn't a board this version of Forma can read.`);
      }
      const board = emptyBoard(root);
      await queue(() => write(board));
      return board;
    },
    save(board) {
      pending = board;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush().catch(() => {}), 300);
    },
    flush,
    versions: () => keeper.list(),
    async restore(name) {
      const text = await keeper.read(name);
      const board = parseBoard(text, resolve);
      if (!board) throw new Error("That version isn't a board this version of Forma can read.");
      // What's on screen goes to disk first, and is kept as a version itself.
      await flush().catch(() => {});
      await keeper.keep(known, "restore");
      await queue(() => put(text));
      changed = true;
      listener?.(board);
    },
    async importMedia(file, source): Promise<Item> {
      if (isDocFile(file)) return importDocToFolder(root, file, source);
      const id = newId("item");
      const name = `${id}.${extensionOf(file)}`;
      await mkdir(join(root, MEDIA_DIR), { recursive: true });
      if (isVideoFile(file)) {
        // The video itself, and a still of it beside it for the board to show.
        const [bytes, { w, h, still }] = await Promise.all([file.arrayBuffer(), videoStill(file)]);
        await writeFile(join(root, MEDIA_DIR, name), new Uint8Array(bytes));
        const rel = join(MEDIA_DIR, name);
        const poster = still ? join(MEDIA_DIR, `${id}.jpg`) : undefined;
        if (still && poster) await writeFile(join(root, poster), new Uint8Array(await still.arrayBuffer()));
        const fields = await newImageFields(still, source);
        const shown = poster ? { poster, posterSrc: resolve(poster) } : {};
        return { id, kind: "video", file: rel, src: resolve(rel), ...shown, w, h, title: titleFromName(file.name), ...fields };
      }
      const [bytes, size, fields] = await Promise.all([file.arrayBuffer(), imageSize(file), newImageFields(file, source)]);
      await writeFile(join(root, MEDIA_DIR, name), new Uint8Array(bytes));
      const rel = join(MEDIA_DIR, name);
      return { id, kind: "image", file: rel, src: resolve(rel), ...size, title: titleFromName(file.name), ...fields };
    },
    watch(onChange) {
      let stop: (() => void) | null = null;
      let cancelled = false;
      listener = onChange;
      watch(
        root,
        async (event) => {
          if (!event.paths.some((p) => p.endsWith(`/${BOARD_FILE}`))) return;
          try {
            const text = await readTextFile(boardPath);
            if (text === known) return;
            const board = parseBoard(text, resolve);
            // A half-written or broken file from someone else: wait for the next change.
            if (!board) return;
            // The board as it was before this change, so it can be brought back.
            void keeper.keep(known, "outside");
            known = text;
            changed = true;
            onChange(board);
          } catch {
            // The file is mid-replace; the next event will catch it.
          }
        },
        { delayMs: 150 },
      )
        .then((unwatch) => {
          if (cancelled) unwatch();
          else stop = unwatch;
        })
        .catch((e) => console.error("Could not watch the project folder", e));
      return () => {
        cancelled = true;
        if (listener === onChange) listener = null;
        stop?.();
      };
    },
  };
}

/**
 * Makes the sample project in a folder: copies the sample images into media/
 * and its live card's component into components/, and writes a board that
 * points at them. Used by "Open the sample" on an empty home.
 */
export async function seedSample(root: string, sample: Board) {
  await mkdir(join(root, MEDIA_DIR), { recursive: true });
  await mkdir(join(root, COMPONENTS_DIR), { recursive: true });
  const copied = new Map<string, string>();
  const copy = async (src: string | undefined) => {
    const dir = src?.startsWith("/sample/") ? MEDIA_DIR : src?.startsWith("/live/") ? COMPONENTS_DIR : null;
    if (!src || !dir) return undefined;
    const cached = copied.get(src);
    if (cached) return cached;
    const name = src.split("/").pop()!;
    const rel = join(dir, name);
    const res = await fetch(src);
    if (!res.ok) return undefined;
    await writeFile(join(root, rel), new Uint8Array(await res.arrayBuffer()));
    copied.set(src, rel);
    return rel;
  };
  const withFile = async (item: Item) => {
    const file = await copy(item.src);
    return file ? { ...item, file } : item;
  };
  const nodes = await Promise.all(
    sample.nodes.map(async (n) => {
      const d = n.data as { items?: Item[]; item?: Item };
      if (d.items) return { ...n, data: { ...d, items: await Promise.all(d.items.map(withFile)) } };
      if (d.item) return { ...n, data: { ...d, item: await withFile(d.item) } };
      return n;
    }),
  );
  await writeTextFile(join(root, BOARD_FILE), serialize({ nodes, edges: sample.edges }));
}
