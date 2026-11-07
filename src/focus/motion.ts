// Motion, tuned by eye. Springs use Motion's visualDuration (seconds until it
// looks settled, whatever the distance) and bounce (0 is critically damped),
// so a long flight lands as softly as a short one.

import type { Transition } from "motion/react";

/** Images leaving the pile for the grid. */
export const OPEN_SPRING = { type: "spring", visualDuration: 0.62, bounce: 0.12 } as const;
/** Gap between images leaving the pile, cover first. */
export const OPEN_STAGGER = 0.034;
/** The whole deal-out never spreads longer than this, however big the stack. */
export const OPEN_STAGGER_MAX = 0.3;
/** Images going back onto the pile: a little quicker, no overshoot. */
export const CLOSE_SPRING = { type: "spring", visualDuration: 0.48, bounce: 0.04 } as const;
/** Gap between images going back, deepest first, cover last. */
export const CLOSE_STAGGER = 0.02;
export const CLOSE_STAGGER_MAX = 0.16;
/** The board behind blurring and dimming, and clearing again. */
export const VEIL_IN: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };
export const VEIL_OUT: Transition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };
/** Images deeper than the four the pile shows fade in from under it, and out into it. */
export const DEEP_FADE: Transition = { duration: 0.22, ease: "easeOut" };
/** How long before landing a deep image starts to fade out on close. */
export const DEEP_FADE_LEAD = 0.16;
/** Others making room while you drag, and anything else that changes slots. */
export const REFLOW_SPRING = { type: "spring", visualDuration: 0.4, bounce: 0.12 } as const;
/** Picking an image up to drag it, and the size it is held at. */
export const PICKUP_SPRING = { type: "spring", visualDuration: 0.22, bounce: 0.2 } as const;
export const DRAG_SCALE = 1.05;
/** Letting go: the image settles into its new slot. */
export const DROP_SPRING = { type: "spring", visualDuration: 0.36, bounce: 0.16 } as const;
/** One image lifted toward you and put back. */
export const LIFT_SPRING = { type: "spring", visualDuration: 0.44, bounce: 0.1 } as const;
export const LIFT_FADE: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
/** prefers-reduced-motion: everything crossfades in place. */
export const REDUCED_FADE: Transition = { duration: 0.2, ease: "easeOut" };
/** Free space kept around the grid; the top leaves room for the title. */
export const MARGINS = { top: 112, right: 72, bottom: 96, left: 72 };
