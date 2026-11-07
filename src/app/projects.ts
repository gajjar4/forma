// Choosing and remembering project folders (Mac app only).

import { documentDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { sampleEdges, sampleNodes } from "../model/sample";
import { BOARD_FILE, join, seedSample } from "../store/folder";

const RECENT = "forma.recentProjects";
/**
 * How many recent projects are remembered. The home finds boards outside
 * Documents/Forma only through this list, so it keeps plenty.
 */
const RECENT_MAX = 40;

/** The recent list with `root` first, each folder once, the oldest let go past `max`. */
export function withRecent(list: string[], root: string, max = RECENT_MAX): string[] {
  return [root, ...list.filter((r) => r !== root)].slice(0, max);
}

/** Folders opened lately, the latest first. */
export function recentProjects(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT) ?? "[]");
    return Array.isArray(list) ? list.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}

export const inApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Adds a folder to the recent ones, first. */
export function rememberProject(root: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify(withRecent(recentProjects(), root)));
  } catch {
    // Not remembered; it only leaves the recent list.
  }
}

/** Asks for a folder. An empty one becomes a new project. */
export async function pickFolder(title: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, recursive: true, title });
  return typeof picked === "string" ? picked : null;
}

/** Where Forma keeps projects it makes for you: Documents/Forma. */
export async function projectsHome(): Promise<string> {
  return join(await documentDir(), "Forma");
}

/** Makes the sample project at Documents/Forma/Northwind (or reopens it) and returns its path. */
export async function makeSample(): Promise<string> {
  const root = join(await projectsHome(), "Northwind");
  if (await exists(join(root, BOARD_FILE))) return root;
  await mkdir(root, { recursive: true });
  await seedSample(root, { nodes: sampleNodes, edges: sampleEdges });
  return root;
}
