// Keeping earlier versions of a board on disk (the Mac app). What to keep and
// what to let go of is decided in versions.ts; the files are written by the
// app itself (src-tauri/src/history.rs), in its own data folder, never in the
// project folder.

import { invoke } from "@tauri-apps/api/core";
import { historyKey, latestFirst, shouldKeep, toPrune, versionName, type Last, type Reason } from "./versions";

export type Version = { name: string; time: number };

export type Keeper = {
  /**
   * Keeps `text` (a whole board.json) as a version, when versions.ts says so.
   * Runs after whatever it was called from, never in its way, and never fails:
   * a version that can't be kept is logged and the board carries on.
   */
  keep(text: string, reason: Reason): Promise<void>;
  /** The versions kept, the latest first. */
  list(): Promise<Version[]>;
  /** One version's text. */
  read(name: string): Promise<string>;
};

/** One keeper per folder, so a board opened twice in a session shares what it remembers. */
const keepers = new Map<string, Keeper>();

export function keeperFor(root: string): Keeper {
  let keeper = keepers.get(root);
  if (!keeper) keepers.set(root, (keeper = makeKeeper(historyKey(root))));
  return keeper;
}

function makeKeeper(key: string): Keeper {
  const list = async () => latestFirst(await invoke<string[]>("history_list", { key }));
  const read = (name: string) => invoke<string>("history_read", { key, name });

  let last: Last = null;
  let lastTime = 0;
  /** The text of the latest version on disk, once looked up: no copy of it twice across restarts. */
  let onDisk: string | null | undefined;
  let queue: Promise<void> = Promise.resolve();

  const keep = (text: string, reason: Reason) => {
    // Every version gets its own name, even two in the same millisecond.
    const now = Math.max(Date.now(), lastTime + 1);
    if (!shouldKeep(last, text, now, reason)) return queue;
    last = { at: now, text };
    lastTime = now;
    queue = queue
      .then(async () => {
        if (onDisk === undefined) {
          const latest = (await list())[0];
          onDisk = latest ? await read(latest.name) : null;
        }
        if (text === onDisk) return;
        const names = await invoke<string[]>("history_write", { key, name: versionName(now), text });
        onDisk = text;
        const old = toPrune(names);
        if (old.length) await invoke("history_remove", { key, names: old });
      })
      .catch((e) => {
        onDisk = undefined;
        console.error("Could not keep an earlier version of the board", e);
      });
    return queue;
  };

  return { keep, list, read };
}
