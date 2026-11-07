// Timing frames inside the page, and turning the timings into a verdict.

/** The bar a run has to clear. */
export const MIN_FPS = 55;
export const SLOW_MS = 20;
export const MAX_SLOW_SHARE = 0.05;

/**
 * Runs in the page: records every animation frame for `ms`. With a `motion`,
 * each frame also sends a wheel event to whatever is under the pointer, the
 * way a trackpad would: "pan" drifts the board around in loops, "zoom" pinches
 * in and back out (a ctrl+wheel is a pinch). Returns the gaps between frames, in ms.
 */
export function recordFrames({ ms, at, motion }) {
  const target = document.elementFromPoint(at[0], at[1]) ?? document.body;
  const motions = {
    pan: (i) => ({ deltaX: Math.sin(i / 20) * 14, deltaY: Math.cos(i / 26) * 10 }),
    zoom: (i) => ({ deltaY: -Math.sin(i / 30) * 1.5, ctrlKey: true }),
  };
  const step = motions[motion];
  return new Promise((done) => {
    const times = [];
    let i = 0;
    const frame = (now) => {
      times.push(now);
      if (step) {
        const init = { ...step(i++), clientX: at[0], clientY: at[1], bubbles: true, cancelable: true };
        target.dispatchEvent(new WheelEvent("wheel", init));
      }
      if (now - times[0] < ms) requestAnimationFrame(frame);
      else done(times.slice(1).map((t, k) => t - times[k]));
    };
    requestAnimationFrame(frame);
  });
}

/** Average fps, 95th percentile frame time, share of frames over SLOW_MS, and whether that passes. */
export function summarise(gaps) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const fps = 1000 / avg;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const slow = sorted.filter((g) => g > SLOW_MS).length / sorted.length;
  return { frames: sorted.length, fps, p95, slow, pass: fps >= MIN_FPS && slow <= MAX_SLOW_SHARE };
}
