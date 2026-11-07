import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Check, ChevronDown, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { inApp, recentProjects } from "../app/projects";
import { useFullscreen } from "../app/useFullscreen";
import { folderName } from "../store/folder";
import type { BoardStore } from "../store/types";
import { Versions } from "./Versions";

type Props = {
  name: string;
  root?: string;
  onSwitch: () => void;
  onOpen: (root: string) => void;
  /** Back to the home screen and all the boards. Absent where there is no home (a plain browser tab). */
  onHome?: () => void;
  /** The open board's store, for its earlier versions where they're kept. */
  store?: BoardStore;
};

/** A folder as people read it: the home folder as ~. */
const shortPath = (root: string) => root.replace(/^\/Users\/[^/]+/, "~");

/** How many recent projects the menu offers. */
const RECENT_SHOWN = 6;

/**
 * Where the project lives, with a button that copies its full path: what you
 * hand an AI so it works in exactly this folder. The line itself says so
 * for a moment once it's copied.
 */
function PathRow({ root }: { root: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(root)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };
  return (
    <button className="project-menu-path" data-copied={copied || undefined} title={root} onClick={copy}>
      <span className="project-menu-path-text">{copied ? "Copied the full path" : shortPath(root)}</span>
      <span className="project-menu-copy" aria-hidden>
        {copied ? <Check /> : <Copy />}
      </span>
    </button>
  );
}

/**
 * The open project, top left: a pill like the rest of the chrome, beside the
 * window buttons (in the corner when full screen). Its menu shows where the
 * project lives, the recent ones to switch to, and what you can do with it.
 */
export function ProjectChip({ name, root, onSwitch, onOpen, onHome, store }: Props) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  // The corner is free when full screen, and in a browser (no window buttons).
  const corner = useFullscreen() || !inApp;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setRecent(recentProjects().filter((r) => r !== root).slice(0, RECENT_SHOWN));
    setOpen((o) => !o);
  };
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="project-chip" data-full={corner || undefined} ref={ref}>
      <button className="project-chip-button chrome" aria-expanded={open} onClick={toggle}>
        <span className="project-chip-name">{name}</span>
        <ChevronDown aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="project-menu chrome"
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
          >
            <div className="project-menu-head">
              <span className="project-menu-name">{name}</span>
              {root ? <PathRow root={root} /> : <span className="project-menu-path">Saved in this browser</span>}
            </div>
            {recent.length > 0 && (
              <div className="project-menu-group">
                <span className="project-menu-label">Recent</span>
                {recent.map((r) => (
                  <button key={r} role="menuitem" title={r} onClick={pick(() => onOpen(r))}>
                    {folderName(r)}
                  </button>
                ))}
              </div>
            )}
            {root ? (
              <div className="project-menu-group">
                <button role="menuitem" onClick={pick(onSwitch)}>
                  Open another folder…
                </button>
                <button role="menuitem" onClick={pick(() => revealItemInDir(root).catch(() => {}))}>
                  Show in Finder
                </button>
                {store?.versions && <Versions store={store} onPicked={() => setOpen(false)} />}
                {onHome && (
                  <button role="menuitem" onClick={pick(onHome)}>
                    All boards
                  </button>
                )}
              </div>
            ) : (
              <>
                <span className="project-menu-note">Open the Mac app to work in a folder.</span>
                {onHome && (
                  <div className="project-menu-group">
                    <button role="menuitem" onClick={pick(onHome)}>
                      All boards
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
