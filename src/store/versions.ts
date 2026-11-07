// Earlier versions of a board, kept so an accidental delete (yours or your
// AI's) can be brought back. They live in the app's own data folder, never in
// the project folder: that is what you share with your AI, and it stays clean.
//
//   <app data>/history/<key>/board-2026-11-03T14-32-05-123Z.json
//
// This module is the pure part: names, which to let go, when to keep one, and
// how a version reads in the menu. The disk part is keeper.ts.

/** How many versions each board keeps. */
export const KEEP = 50;
/** While you keep editing, at most one version this often. */
export const EVERY_MS = 30_000;

/**
 * Why a version is kept. "save": the board as it was before one of your saves
 * (throttled). "outside": as it was before a change from outside replaced it.
 * "restore": as it was before an earlier version was brought back. "leave":
 * as you left it, so a change made while the app is closed can be undone.
 */
export type Reason = "save" | "outside" | "restore" | "leave";

/** Two FNV-1a passes with different seeds: 16 hex characters, the same for the same path. */
export function hashPath(path: string): string {
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < path.length; i++) {
      h ^= path.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return pass(0x811c9dc5) + pass(0x050c5d1f);
}

/** The folder a board's versions go in: its name, readable in Finder, and a hash of its full path. */
export function historyKey(root: string): string {
  const clean = root.replace(/\/+$/, "");
  const name = (clean.split("/").pop() ?? "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${name || "board"}-${hashPath(clean)}`;
}

const NAME = /^board-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/;

/** The file a version kept at `time` is written to. Names sort by time. */
export function versionName(time: number): string {
  return `board-${new Date(time).toISOString().replace(/[:.]/g, "-")}.json`;
}

/** When a version was kept, read back from its name. Null for anything else in the folder. */
export function versionTime(name: string): number | null {
  const m = NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, ms] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s, ms);
}

/** The versions in a folder listing, the latest first. */
export function latestFirst(names: string[]): { name: string; time: number }[] {
  return names
    .flatMap((name) => {
      const time = versionTime(name);
      return time === null ? [] : [{ name, time }];
    })
    .sort((a, b) => b.time - a.time);
}

/** The versions to let go of so only the latest `keep` remain. */
export function toPrune(names: string[], keep = KEEP): string[] {
  return latestFirst(names)
    .slice(keep)
    .map((v) => v.name);
}

/** What the keeper remembers between versions. */
export type Last = { at: number; text: string } | null;

/**
 * Whether to keep `text` as a version now. Never an empty board text or the
 * same text as the version kept last. Before your own saves, at most one
 * every `EVERY_MS`; anything else (a change from outside, a restore, leaving)
 * is always kept.
 */
export function shouldKeep(last: Last, text: string, now: number, reason: Reason): boolean {
  if (!text.trim()) return false;
  if (last && last.text === text) return false;
  if (reason === "save" && last && now - last.at < EVERY_MS) return false;
  return true;
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Midnight at the start of `time`'s day, local time. */
const dayStart = (time: number) => {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * How a version reads in the menu, in local time: "Today 14:32",
 * "Yesterday 09:10", "2 Nov 14:32", and the year when it isn't this one.
 * `seconds` adds them, for two versions kept in the same minute.
 */
export function versionLabel(time: number, now: number, seconds = false): string {
  const d = new Date(time);
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? `:${pad(d.getSeconds())}` : ""}`;
  const days = Math.round((dayStart(now) - dayStart(time)) / 86_400_000);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Yesterday ${clock}`;
  const year = d.getFullYear() === new Date(now).getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} ${clock}`;
}

/** Labels for a list of times, with seconds wherever two would otherwise read the same. */
export function versionLabels(times: number[], now: number): string[] {
  const plain = times.map((t) => versionLabel(t, now));
  return times.map((t, i) => (plain.filter((p) => p === plain[i]).length > 1 ? versionLabel(t, now, true) : plain[i]));
}
