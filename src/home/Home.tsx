import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useFullscreen } from "../app/useFullscreen";
import { inApp } from "../app/projects";
import { diveTransform, homeLayout } from "./layout";
import { DIVE_FADE, DIVE_SPRING, HOME_FADE, LEAVE_FADE, RETURN_FADE, RETURN_SPRING } from "./motion";
import { BoardPile, NewPile } from "./Pile";
import type { HomeSource, Opened } from "./source";
import type { BoardSummary } from "./summary";
import { useDecoded } from "./useDecoded";

type Props = {
  source: HomeSource;
  /** The board just left, if any: the home comes back out of its pile. */
  from: string | null;
  /** Why the last board didn't open, if it didn't. */
  notice: string | null;
  onEnter: (opened: Opened) => void;
};

const NONE = "translate(0px, 0px) scale(1)";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : typeof e === "string" ? e : fallback);

/**
 * Forma itself, with no board open: a board of boards. The same warm surface
 * and dots, and every board on this Mac sitting on it as a pile of its own
 * pictures, the latest first, then a spot for a new one. Going into a board
 * is the camera moving into its pile; leaving one comes back out of it.
 */
export function Home({ source, from, notice, onEnter }: Props) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice);
  const corner = useFullscreen() || !inApp;
  const layer = useRef<HTMLDivElement>(null);
  const chrome = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  const ready = useDecoded(boards);

  useEffect(() => {
    let live = true;
    source
      .list()
      .then((list) => live && setBoards(list))
      .catch((e) => {
        if (!live) return;
        setBoards([]);
        setError(message(e, "Couldn't read your boards."));
      });
    const resize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => {
      live = false;
      window.removeEventListener("resize", resize);
    };
  }, [source]);

  // Once the piles' pictures are decoded, the home appears: out of the board
  // just left, or with a short fade.
  useEffect(() => {
    const el = layer.current;
    if (!ready || shown.current || !el) return;
    shown.current = true;
    const pile = from ? el.querySelector<HTMLElement>(`[data-root="${CSS.escape(from)}"] .stack-pile`) : null;
    if (chrome.current) animate(chrome.current, { opacity: [0, 1] }, HOME_FADE);
    if (!pile || reduced()) {
      animate(el, { opacity: [0, 1] }, HOME_FADE);
      return;
    }
    // Scroll the pile into view first, then start zoomed into it and pull back.
    const r = pile.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) el.scrollTop += r.top - (window.innerHeight - r.height) / 2;
    const t = diveTransform(pile.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    animate(el, { transform: [`translate(${t.x}px, ${t.y}px) scale(${t.scale})`, NONE] }, RETURN_SPRING);
    animate(el, { opacity: [0, 1] }, RETURN_FADE);
  }, [ready, from]);

  /** Goes into a board: the camera moves into its pile while the board loads, then the board takes over. */
  const dive = async (pile: HTMLElement | null, load: () => Promise<Opened | null>) => {
    const el = layer.current;
    if (busy || !el) return;
    setBusy(true);
    setError(null);
    const fades = chrome.current ? [animate(chrome.current, { opacity: 0 }, LEAVE_FADE)] : [];
    const moves =
      pile && !reduced()
        ? (() => {
            const t = diveTransform(pile.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
            return [
              animate(el, { transform: [NONE, `translate(${t.x}px, ${t.y}px) scale(${t.scale})`] }, DIVE_SPRING),
              animate(el, { opacity: 0 }, DIVE_FADE),
            ];
          })()
        : [animate(el, { opacity: 0 }, LEAVE_FADE)];
    try {
      // The board is on screen once it is loaded and the camera is all the way in.
      const [opened] = await Promise.all([load(), moves[moves.length - 1], ...fades]);
      if (opened) {
        onEnter(opened);
        return;
      }
    } catch (e) {
      setError(message(e, "Couldn't open that board."));
    }
    // Nothing to open after all: come back out.
    for (const m of moves) m.stop();
    animate(el, { transform: NONE, opacity: 1 }, RETURN_SPRING);
    if (chrome.current) animate(chrome.current, { opacity: 1 }, HOME_FADE);
    setBusy(false);
  };

  /** A board somewhere else: the folder is chosen first, and the home only leaves once there is one. */
  const openFolder = async () => {
    if (busy) return;
    try {
      const opened = await source.pick();
      if (opened) void dive(null, async () => opened);
    } catch (e) {
      setError(message(e, "Couldn't open that folder."));
    }
  };

  const list = boards ?? [];
  const layout = homeLayout(list.length + 1, size.w, size.h);
  const newSpot = layout.spots[list.length];
  const empty = boards !== null && list.length === 0;

  return (
    <>
      <div className="home" ref={layer} data-busy={busy || undefined}>
        <div className="home-surface" style={{ height: layout.height }}>
          {list.map((b, i) => (
            <BoardPile key={b.root} board={b} spot={layout.spots[i]} onOpen={(root, pile) => void dive(pile, () => source.open(root))} />
          ))}
          {boards && <NewPile spot={newSpot} busy={busy} onCreate={(name, pile) => void dive(pile, () => source.create(name))} />}
          {empty && (
            <p className="home-line" style={{ translate: `${newSpot.x}px ${newSpot.y}px` }}>
              Each board is a folder in Documents/Forma.{" "}
              <button onClick={() => void dive(null, source.sample)}>Open the sample</button>
            </p>
          )}
        </div>
      </div>
      <div className="home-chrome">
        {/* The home's title, set where a board's pill puts its name, so the word stays put going in. */}
        <div className="project-chip" data-full={corner || undefined}>
          <div className="project-chip-button home-chip">Forma</div>
        </div>
        <div ref={chrome}>
          <button className="home-open" data-full={corner || undefined} onClick={() => void openFolder()}>
            Open a folder…
          </button>
          {error && <p className="home-error">{error}</p>}
        </div>
      </div>
    </>
  );
}
