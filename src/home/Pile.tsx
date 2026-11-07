import { useState, type CSSProperties } from "react";
import { ItemFace } from "../canvas/nodes/Faces";
import { fitInBox } from "../canvas/nodes/fit";
import { pose } from "../canvas/nodes/pose";
import { NOTE_SHAPE } from "../model/items";
import { PILE, type Spot } from "./layout";
import { metaLine, type BoardSummary } from "./summary";

/** The biggest a card in the pile is drawn, as on the board (StackNode). */
const BOX = 176;

/** A soft blank card for a board with nothing to show yet, the shape of a note. */
const BLANK = fitInBox({ id: "blank", kind: "note", ...NOTE_SHAPE }, BOX);

/** A pile's place on the surface: its centre on a dot. */
const placed = ({ x, y }: Spot): CSSProperties => ({ translate: `${x}px ${y}px` });

/** The pile's own cards (the element the camera moves into), from a click inside it. */
const pileOf = (target: EventTarget) => (target as HTMLElement).closest(".home-pile")?.querySelector<HTMLElement>(".stack-pile");

type Props = {
  board: BoardSummary;
  spot: Spot;
  onOpen: (root: string, pile: HTMLElement) => void;
};

/**
 * A board on the home screen: a pile of its own pictures, exactly like a
 * stack on the board, with its name and a quiet line under it. Hover fans it
 * the same way (nodes.css .stack-card), a click goes in.
 */
export function BoardPile({ board, spot, onOpen }: Props) {
  const faces = board.faces;
  return (
    <button
      className="home-pile"
      data-root={board.root}
      style={placed(spot)}
      onClick={(e) => {
        const pile = pileOf(e.currentTarget);
        if (pile) onOpen(board.root, pile);
      }}
    >
      <span className="stack-pile" style={{ width: PILE, height: PILE }}>
        {faces.length === 0 ? (
          <span className="stack-card home-blank" style={{ ...BLANK, ...pose(0) }} />
        ) : (
          faces
            .map((item, i) => (
              <span
                key={item.id}
                className="stack-card"
                data-kind={item.kind}
                style={{ ...fitInBox(item, BOX), ...pose(i), zIndex: 10 - i }}
              >
                <ItemFace item={item} />
              </span>
            ))
            .reverse()
        )}
      </span>
      <span className="home-pile-name">{board.name}</span>
      <span className="home-pile-meta">{metaLine(board)}</span>
    </button>
  );
}

/** Forma's dot-plus: five dots gathered into a plus, as on the ports and the app icon. */
function DotPlus() {
  return (
    <span className="home-plus" aria-hidden>
      {[
        [0, 0],
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].map(([dx, dy]) => (
        <i key={`${dx}${dy}`} style={{ "--dx": dx, "--dy": dy } as CSSProperties} />
      ))}
    </span>
  );
}

type NewProps = {
  spot: Spot;
  busy: boolean;
  onCreate: (name: string, pile: HTMLElement) => void;
};

/**
 * The last spot in the grid: an empty surface with the dot-plus on it. A
 * click turns its title into the board's name; Enter makes the board and
 * goes in, Escape lets it go.
 */
export function NewPile({ spot, busy, onCreate }: NewProps) {
  const [naming, setNaming] = useState(false);
  return (
    <div className="home-pile home-new" data-naming={naming || undefined} style={placed(spot)}>
      <button className="stack-pile" style={{ width: PILE, height: PILE }} aria-label="New board" onClick={() => setNaming(true)}>
        <span className="stack-card home-new-card" style={{ width: BOX, height: BOX, ...pose(0) }}>
          <DotPlus />
        </span>
      </button>
      {naming ? (
        <input
          className="home-new-input"
          autoFocus
          placeholder="Name your board"
          disabled={busy}
          spellCheck={false}
          onBlur={(e) => {
            if (!busy && !e.currentTarget.value.trim()) setNaming(false);
          }}
          onKeyDown={(e) => {
            const name = e.currentTarget.value.trim();
            if (e.key === "Escape") setNaming(false);
            if (e.key === "Enter" && name && !busy) {
              const pile = pileOf(e.currentTarget);
              if (pile) onCreate(name, pile);
            }
          }}
        />
      ) : (
        <button className="home-pile-name" onClick={() => setNaming(true)}>
          New board
        </button>
      )}
    </div>
  );
}
