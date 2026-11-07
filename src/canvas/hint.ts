// The one line a brand-new board shows under its project, saying what to do.
// It shows only on a board that holds nothing but its project, until the
// first thing is added; after that it never shows on that board again, even
// if the board is emptied. Pure, apart from remembering which boards are past
// it (in this Mac's local storage).

import type { Node } from "@xyflow/react";

export const HINT_START = "Paste or drop anything here, or ";
export const HINT_ASK = "ask your AI";
export const HINT = `${HINT_START}${HINT_ASK}.`;
/** What the line says for a moment once the prompt is copied. */
export const HINT_COPIED = "Copied a prompt. Paste it into your AI.";

/**
 * What "ask your AI" copies: enough for any AI to start on this board,
 * starting with where it is, so it never has to ask.
 */
export function starterPrompt(root?: string) {
  const where = root ? `This is my new Forma board, in the folder ${root}. Read SKILL.md in that folder first` : "This is my new Forma board. Read its SKILL.md first";
  return `${where}: it says how to work on the board. Then help me start it: ask me what this project is, write the project's brief with me, and add the first notes and research around it.`;
}

const KEY = "forma.hinted";
/** How many boards are remembered: plenty, and the list never grows without end. */
const KEEP = 200;

/** True when the board is only its project: nothing added yet. */
export const onlyProject = (nodes: Node[]) => nodes.length === 1 && nodes[0].type === "project";

/** Every remembered board, the latest first, with `board` added at the front. */
export function withBoard(list: string[], board: string, keep = KEEP) {
  return [board, ...list.filter((b) => b !== board)].slice(0, keep);
}

function read(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((b): b is string => typeof b === "string") : [];
  } catch {
    return [];
  }
}

/** Whether this board has had something added since it was new. */
export const pastHint = (board: string) => read().includes(board);

/** Remembers that this board is past its hint. */
export function rememberPastHint(board: string) {
  try {
    if (!pastHint(board)) localStorage.setItem(KEY, JSON.stringify(withBoard(read(), board)));
  } catch {
    // Not remembered: the hint may show again on an emptied board, nothing worse.
  }
}
