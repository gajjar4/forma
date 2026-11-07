import { useInternalNode, ViewportPortal } from "@xyflow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { HINT_ASK, HINT_COPIED, HINT_START, pastHint, rememberPastHint, starterPrompt } from "./hint";

type Props = {
  /** Which board this is (its folder), so the hint is remembered for it. */
  board: string;
  /** The board's folder, for the prompt "ask your AI" copies (none in a browser). */
  root?: string;
  /** The project's node. */
  projectId: string;
  /** True while the board holds only its project. */
  bare: boolean;
};

/** How far under the project the line sits, in board units: two dots. */
const BELOW = 64;

/**
 * One quiet line under a new board's project, saying what to do. It fades
 * away the moment anything is added and never comes back for that board.
 * Only "ask your AI" takes the pointer: it copies a prompt to start with.
 * Nothing is drawn for any other board.
 */
export function EmptyHint({ board, root, projectId, bare }: Props) {
  const [phase, setPhase] = useState<"hint" | "past">(() => (bare && !pastHint(board) ? "hint" : "past"));
  // Something was added: past the hint for good (set while rendering, React's way to follow a prop).
  if (phase === "hint" && !bare) setPhase("past");
  useEffect(() => {
    if (phase === "past") rememberPastHint(board);
  }, [phase, board]);
  return <AnimatePresence>{phase === "hint" && <Line key="hint" projectId={projectId} root={root} />}</AnimatePresence>;
}

function Line({ projectId, root }: { projectId: string; root?: string }) {
  const project = useInternalNode(projectId);
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () => {
    navigator.clipboard
      ?.writeText(starterPrompt(root))
      .then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2400);
      })
      .catch(() => {});
  };
  if (!project?.measured.height) return null;
  const { x, y } = project.internals.positionAbsolute;
  const w = project.measured.width ?? 0;
  return (
    <ViewportPortal>
      <motion.div
        className="empty-hint"
        style={{ left: x + w / 2, top: y + project.measured.height + BELOW }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.4 } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.32 } }}
      >
        {/* The line blurs out and the other blurs in, one after the other. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "copied" : "ask"}
            className="empty-hint-line"
            initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: 3 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", y: -3, transition: { duration: 0.16, ease: "easeIn" } }}
          >
            {copied ? (
              HINT_COPIED
            ) : (
              <>
                {HINT_START}
                <button className="empty-hint-ask nodrag nopan" onClick={copy} title="Copies a prompt to start this board with your AI">
                  {HINT_ASK}
                </button>
                .
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </ViewportPortal>
  );
}
