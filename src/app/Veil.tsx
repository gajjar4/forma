import { animate } from "motion/react";
import { useEffect, useEffectEvent, useRef } from "react";
import { BOARD_IN, BOARD_OUT } from "../home/motion";

/** Longest the board waits for its pictures before it is shown anyway. */
const WAIT_MS = 500;

const frame = () => new Promise((r) => requestAnimationFrame(r));

/**
 * Resolves once a board just put on screen has settled: React Flow has
 * measured it and fitted the view (a couple of frames), and the pictures in
 * the window are decoded.
 */
async function boardSettled() {
  await frame();
  await frame();
  const inView = [...document.querySelectorAll<HTMLImageElement>(".react-flow img")].filter((img) => {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  });
  const wait = new Promise((r) => window.setTimeout(r, WAIT_MS));
  await Promise.race([Promise.all(inView.map((img) => img.decode().catch(() => {}))), wait]);
}

type Props = {
  /** Covering the board (on the way out) rather than uncovering it (on the way in). */
  cover: boolean;
  onDone: () => void;
};

/**
 * The bare surface over the board while it arrives or leaves: the board's
 * own colour, so going between the home and a board never flashes. It sits
 * under the chrome, so the pill top left stays put while the board appears.
 */
export function Veil({ cover, onDone }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useEffectEvent(onDone);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    let stop = () => {};
    void (async () => {
      if (!cover) await boardSettled();
      if (!live) return;
      const run = animate(el, { opacity: cover ? [0, 1] : [1, 0] }, cover ? BOARD_OUT : BOARD_IN);
      stop = () => run.stop();
      await run;
      if (live) done();
    })();
    return () => {
      live = false;
      stop();
    };
  }, [cover]);
  return <div ref={ref} className="veil-board" style={{ opacity: cover ? 0 : 1 }} aria-hidden />;
}
