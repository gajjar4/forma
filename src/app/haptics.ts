// The Force Touch trackpad tick: felt under the finger when something snaps,
// without a click. Mac app only; a no-op in the browser.

import { invoke } from "@tauri-apps/api/core";
import { inApp } from "./projects";

/** Ticks closer together than this merge into one, so a jittery snap never buzzes. */
const GAP_MS = 90;
let last = 0;

export function haptic(kind: "alignment" | "level" = "alignment") {
  if (!inApp) return;
  const now = performance.now();
  if (now - last < GAP_MS) return;
  last = now;
  invoke("haptic", { kind }).catch(() => {});
}
