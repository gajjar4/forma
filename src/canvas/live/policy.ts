// Which live cards may run right now. Pure, so the rules are tested on their
// own; runner.ts feeds it what the board looks like and mounts the frames.
//
// Only what you look at runs: a card on screen, with the board zoomed in far
// enough to show detail, that has stayed so for a moment. At most a few run
// at once (the ones nearest the middle of the view win), and none start while
// the board is moving, so a fast pan never creates frames on the way.

/** How long a card has to be wanted before its frame mounts. */
export const START_AFTER_MS = 250;
/** How long a running card is kept after it stops being wanted. */
export const STOP_AFTER_MS = 1000;
/** The most live cards running at once. */
export const MAX_RUNNING = 4;

export type LiveCandidate = {
  id: string;
  /** On screen (from an IntersectionObserver). */
  visible: boolean;
  /** From its centre to the middle of the view, in any one unit. */
  distance: number;
};

export type LiveTrack = {
  running: boolean;
  /** When it last became wanted (null while not wanted). */
  wantedSince: number | null;
  /** When it last stopped being wanted (null while wanted). */
  unwantedSince: number | null;
};

export type LiveScene = {
  now: number;
  /** The zoom shows detail (see detailShows in zoom.ts). */
  detail: boolean;
  /** The board is being panned or zoomed. */
  moving: boolean;
  /** Something sits over the board (an opened stack, a live card opened big). */
  held: boolean;
};

export type LiveDecision = {
  tracks: Map<string, LiveTrack>;
  running: Set<string>;
  /** When to look again even if nothing else changes, or null when nothing is waiting. */
  nextAt: number | null;
};

const IDLE: LiveTrack = { running: false, wantedSince: null, unwantedSince: null };

/**
 * One step of the rules, from what the board looks like now and the tracks
 * from the step before. Cards no longer on the board drop out.
 */
export function decide(cards: LiveCandidate[], scene: LiveScene, before: Map<string, LiveTrack>): LiveDecision {
  const { now } = scene;
  const byDistance = [...cards].sort((a, b) => a.distance - b.distance);
  const wanted = new Set(
    scene.held || !scene.detail
      ? []
      : byDistance
          .filter((c) => c.visible)
          .slice(0, MAX_RUNNING)
          .map((c) => c.id),
  );

  const tracks = new Map<string, LiveTrack>();
  let nextAt: number | null = null;
  const later = (t: number) => {
    nextAt = nextAt === null ? t : Math.min(nextAt, t);
  };

  // First the ones already running: they keep going until they have been
  // unwanted long enough.
  let count = 0;
  for (const c of byDistance) {
    const was = before.get(c.id) ?? IDLE;
    const isWanted = wanted.has(c.id);
    const wantedSince = isWanted ? (was.wantedSince ?? now) : null;
    const unwantedSince = isWanted ? null : (was.unwantedSince ?? now);
    let running = was.running;
    if (running && unwantedSince !== null) {
      if (now - unwantedSince >= STOP_AFTER_MS) running = false;
      else later(unwantedSince + STOP_AFTER_MS);
    }
    if (running) count += 1;
    tracks.set(c.id, { running, wantedSince, unwantedSince });
  }

  // Then the ones waiting to start, nearest first, while there is room and
  // the board is still.
  for (const c of byDistance) {
    const t = tracks.get(c.id)!;
    if (t.running || t.wantedSince === null) continue;
    const due = t.wantedSince + START_AFTER_MS;
    if (now < due) {
      later(due);
      continue;
    }
    if (scene.moving || count >= MAX_RUNNING) continue;
    t.running = true;
    count += 1;
  }

  const running = new Set([...tracks].filter(([, t]) => t.running).map(([id]) => id));
  return { tracks, running, nextAt };
}
