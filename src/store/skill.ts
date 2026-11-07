// Every board carries the rules for AIs working on it: a board folder with no
// SKILL.md gets one, a copy of skills/forma/SKILL.md built into the app. An
// AI that opens any board folder then knows how to edit it safely. One that
// is already there is never touched, since the user may have changed it.

import { writeTextFile } from "@tauri-apps/plugin-fs";
import skill from "../../skills/forma/SKILL.md?raw";

export const SKILL_FILE = "SKILL.md";

/** Writes SKILL.md into the board folder unless one is there. Never fails the board's opening. */
export async function ensureSkill(root: string) {
  const path = `${root.replace(/\/+$/, "")}/${SKILL_FILE}`;
  try {
    // createNew: the write fails, and leaves the file alone, when one is there already.
    await writeTextFile(path, skill, { createNew: true });
  } catch {
    // There is one already (or the folder can't be written): either way, nothing to do.
  }
}
