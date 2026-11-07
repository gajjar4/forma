import { useState } from "react";
import type { BoardStore } from "../store/types";
import { versionLabels } from "../store/versions";
import "../styles/versions.css";

type Props = {
  store: BoardStore;
  /** A version was picked: the menu closes. */
  onPicked: () => void;
};

type Row = { name: string; label: string };

/**
 * "Restore an earlier version…" in the project menu: opens, in place, the
 * versions this Mac kept of the board, the latest first. Picking one brings
 * it back as one change ⌘Z can take back, and the board as it was is kept
 * as a version too.
 */
export function Versions({ store, onPicked }: Props) {
  /** The versions, once listed; null while closed. */
  const [rows, setRows] = useState<Row[] | null>(null);

  const toggle = () => {
    if (rows) return setRows(null);
    void (store.versions?.() ?? Promise.resolve([]))
      .then((list) => {
        const labels = versionLabels(
          list.map((v) => v.time),
          Date.now(),
        );
        setRows(list.map((v, i) => ({ name: v.name, label: labels[i] })));
      })
      .catch(() => setRows([]));
  };

  const pick = (name: string) => {
    onPicked();
    void store.restore?.(name).catch((e) => console.error("Could not bring back that version", e));
  };

  return (
    <>
      <button role="menuitem" aria-expanded={!!rows} onClick={toggle}>
        Restore an earlier version…
      </button>
      {rows && (
        <div className="versions" role="group" aria-label="Earlier versions">
          {rows.length ? (
            rows.map((r) => (
              <button key={r.name} role="menuitem" className="versions-time" onClick={() => pick(r.name)}>
                {r.label}
              </button>
            ))
          ) : (
            <span className="versions-none">No earlier versions yet</span>
          )}
        </div>
      )}
    </>
  );
}
