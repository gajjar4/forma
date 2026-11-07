import { useReactFlow } from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { docTextNow, itemsOn, readAll } from "../canvas/docText";
import { Favicon } from "../canvas/nodes/Faces";
import { indexBoard, search, type Marked, type Result, type Target, type Thumb } from "./search";
import { useGoTo } from "./useGoTo";
import { isCmdK, useSearchKeys } from "./useSearchKeys";
import "../styles/search.css";

type Props = {
  /** Off while a stack or a live card covers the board. */
  enabled: boolean;
  /** Opens a stack, as clicking it does. */
  onOpenStack: (stackId: string) => void;
};

/**
 * Search the board: ⌘K (or /), type, and the board glides to what you pick.
 * The panel reads the board once as it opens and keeps everything it does to
 * itself, so typing never touches the board's rendering.
 */
export function Search({ enabled, onOpenStack }: Props) {
  const [open, setOpen] = useState(false);
  // Going somewhere: the panel gets out of the way at once, so nothing
  // blurred sits over the board while it moves.
  const [going, setGoing] = useState(false);
  const goTo = useGoTo(onOpenStack);
  useSearchKeys(enabled && !open, () => {
    setGoing(false);
    setOpen(true);
  });
  const close = useCallback(() => setOpen(false), []);
  const go = useCallback(
    (target: Target) => {
      setGoing(true);
      setOpen(false);
      void goTo(target);
    },
    [goTo],
  );
  return (
    <AnimatePresence custom={going}>
      {open && enabled && <Panel key="search" onClose={close} onGo={go} />}
    </AnimatePresence>
  );
}

const shown = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1 },
  gone: (going: boolean) =>
    going ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } },
};

/** How many results the panel lists at most. */
const SHOWN = 8;

function Panel({ onClose, onGo }: { onClose: () => void; onGo: (target: Target) => void }) {
  const { getNodes, getEdges } = useReactFlow();
  const [index, setIndex] = useState(() => indexBoard(getNodes(), getEdges(), docTextNow));
  // Documents not read yet (deep in a stack) are read now, and searched as soon as they arrive.
  useEffect(() => {
    let live = true;
    void readAll(itemsOn(getNodes())).then((fresh) => {
      if (live && fresh) setIndex(indexBoard(getNodes(), getEdges(), docTextNow));
    });
    return () => {
      live = false;
    };
  }, [getNodes, getEdges]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(index, query, SHOWN), [index, query]);
  const current = Math.min(active, results.length - 1);
  const ref = useRef<HTMLDivElement>(null);

  // A press anywhere else closes it.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [onClose]);

  // Its keys stay here: Backspace edits the query, never deletes from the board.
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape" || isCmdK(e)) {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(Math.max(0, Math.min(results.length - 1, current + step)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[current];
      if (r) onGo(r.target);
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <motion.div
      ref={ref}
      className="search chrome"
      variants={shown}
      initial="hidden"
      animate="shown"
      exit="gone"
      transition={{ type: "spring", stiffness: 500, damping: 34 }}
      onKeyDown={onKeyDown}
    >
      <input
        className="search-input"
        autoFocus
        spellCheck={false}
        autoComplete="off"
        placeholder="Search the board"
        aria-label="Search the board"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="search-results"
        aria-activedescendant={results[current] ? `search-${current}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setActive(0);
        }}
      />
      {hasQuery && (
        <div className="search-results" id="search-results" role="listbox">
          {results.length === 0 && <div className="search-none">Nothing on the board matches</div>}
          {results.map((r, i) => (
            <Row
              key={r.key}
              id={`search-${i}`}
              result={r}
              active={i === current}
              onHover={() => i !== current && setActive(i)}
              onPick={() => onGo(r.target)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Row(props: { id: string; result: Result; active: boolean; onHover: () => void; onPick: () => void }) {
  const { line, snippet, meta, thumb } = props.result;
  return (
    <div
      id={props.id}
      className="search-row"
      role="option"
      aria-selected={props.active}
      data-active={props.active || undefined}
      onPointerMove={props.onHover}
      onClick={props.onPick}
    >
      <ThumbOf thumb={thumb} />
      <span className="search-text">
        <span className="search-line">
          <Marks m={line} />
        </span>
        {snippet && (
          <span className="search-snippet">
            <Marks m={snippet} />
          </span>
        )}
      </span>
      <span className="search-meta">{meta}</span>
    </div>
  );
}

function ThumbOf({ thumb }: { thumb: Thumb }) {
  if (!thumb) return <span className="search-thumb" aria-hidden />;
  return (
    <span className="search-thumb" data-site={"site" in thumb || undefined} aria-hidden>
      {"still" in thumb ? <img src={thumb.still} alt="" draggable={false} decoding="async" /> : <Favicon url={thumb.site} />}
    </span>
  );
}

/** Text with its matched parts in a heavier weight. */
function Marks({ m }: { m: Marked }) {
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [a, b] of m.marks) {
    if (a > at) parts.push({ text: m.text.slice(at, a), hit: false });
    parts.push({ text: m.text.slice(a, b), hit: true });
    at = b;
  }
  if (at < m.text.length) parts.push({ text: m.text.slice(at), hit: false });
  return parts.map((p, i) => (p.hit ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>));
}
