// Saving everything before the app quits or its window closes.
//
// The app holds every way out (src-tauri/src/quit.rs) and asks here first:
// whatever is being typed is committed (each field saves when it loses
// focus), every open board writes what it hasn't yet, and then the app is
// told it can go. It never waits more than LONGEST: a write that fails or
// hangs is logged and the app quits anyway.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { inApp } from "./projects";

/** The longest quitting waits for the boards to be written. */
export const LONGEST = 2000;
/** The event the app sends when it wants to quit (see quit.rs). */
const SAVE_EVENT = "forma://save-and-quit";

/** Writes a board now. `closing`: the app is about to quit, so this is the last write. */
type Saver = (closing: boolean) => Promise<void>;
const savers = new Set<Saver>();

/** Something to write before the app closes: a board's store. Returns a function that takes it back. */
export function saveOnClose(save: Saver): () => void {
  savers.add(save);
  return () => void savers.delete(save);
}

/** Writes everything now, without waiting for the usual moment after a change. */
async function saveAll(closing: boolean) {
  const out = await Promise.allSettled([...savers].map((save) => save(closing)));
  const failed = out.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
}

/**
 * Commits what's being typed, then writes every board. The field's blur
 * hands its text to the board (a React update), and the board reaches its
 * store from an effect, so it waits a moment for both before writing.
 */
export async function saveEverything(): Promise<void> {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
  await new Promise((done) => window.setTimeout(done, 30));
  await saveAll(true);
}

/** saveEverything, but never longer than `limit`. Says what went wrong, if anything. */
export async function saveBeforeClosing(limit = LONGEST): Promise<string | null> {
  let timer: number | undefined;
  const late = new Promise<string>((done) => {
    timer = window.setTimeout(() => done(`saving took over ${limit}ms; closing anyway`), limit);
  });
  try {
    return await Promise.race([saveEverything().then(() => null), late]);
  } catch (e) {
    return `couldn't save before closing: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Answers the app's "about to quit". Returns a function that stops listening. */
export function listenForQuit(): () => void {
  if (!inApp) return () => {};
  let stop: (() => void) | null = null;
  let cancelled = false;
  void listen(SAVE_EVENT, async () => {
    const problem = await saveBeforeClosing();
    if (problem) console.error(`Forma: ${problem}`);
    await invoke("quit_ready", { problem });
  }).then((unlisten) => {
    if (cancelled) unlisten();
    else stop = unlisten;
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

// A reload, or the app being hidden: write now rather than in a moment. These
// can't wait for a write to finish, but they start it straight away.
if (typeof window !== "undefined") {
  const now = () => void saveAll(false).catch(() => {});
  window.addEventListener("beforeunload", now);
  document.addEventListener("visibilitychange", () => document.hidden && now());
}
