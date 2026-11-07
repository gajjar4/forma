// The home screen's motion, tuned by eye, in the style of src/focus/motion.ts.

import type { Transition } from "motion/react";

/** The camera moving into a pile: calm, no overshoot. */
export const DIVE_SPRING = { type: "spring", visualDuration: 0.5, bounce: 0 } as const;
/** The home fading as the camera goes in; the board takes over once it is gone. */
export const DIVE_FADE: Transition = { duration: 0.36, delay: 0.08, ease: [0.4, 0, 1, 1] };
/** Coming back out of a pile after leaving a board. */
export const RETURN_SPRING = { type: "spring", visualDuration: 0.55, bounce: 0 } as const;
export const RETURN_FADE: Transition = { duration: 0.3, ease: [0, 0, 0.2, 1] };
/** The home appearing with nothing to come out of, and its chrome coming back. */
export const HOME_FADE: Transition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };
/** The home leaving without a pile to go into (a folder from elsewhere, the sample). */
export const LEAVE_FADE: Transition = { duration: 0.22, ease: "easeIn" };
/** The board appearing over the empty surface, and covering again on the way out. */
export const BOARD_IN: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
export const BOARD_OUT: Transition = { duration: 0.2, ease: [0.4, 0, 1, 1] };
