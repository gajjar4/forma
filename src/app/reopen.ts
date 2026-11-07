// Coming back to the board that was open. A reload (in any build) returns to
// it, so a page reload never throws you out to the home. In development the
// app restarting (tauri dev rebuilds) does too; a normal launch of the built
// app still starts on the home.

const OPEN = "forma.openBoard";
const DEV_OPEN = "forma.dev.openBoard";

/** The board to go straight back into, if any. */
export function boardToReopen(): string | null {
  try {
    return sessionStorage.getItem(OPEN) ?? (import.meta.env.DEV ? localStorage.getItem(DEV_OPEN) : null);
  } catch {
    return null;
  }
}

/** Remembers the open board's folder, or that none is open (null: back on the home). */
export function rememberOpen(root: string | null) {
  try {
    if (root) {
      sessionStorage.setItem(OPEN, root);
      if (import.meta.env.DEV) localStorage.setItem(DEV_OPEN, root);
    } else {
      sessionStorage.removeItem(OPEN);
      localStorage.removeItem(DEV_OPEN);
    }
  } catch {
    // Not remembered: a reload just starts on the home.
  }
}
