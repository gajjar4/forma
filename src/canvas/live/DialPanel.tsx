import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { getAt, snapToStep, type Dial, type DialValues } from "./dials";

type Slider = Extract<Dial, { kind: "slider" }>;
type Props = {
  name: string;
  dials: Dial[];
  values: DialValues;
  onChange: (path: string, value: unknown) => void;
  /** The card is being put back: the panel fades away before the card lands. */
  leaving?: boolean;
};

/**
 * A live card's dials, beside it while it's open. Each slider is one row:
 * press anywhere on it and drag to set it, the fill showing where it sits in
 * its range. Arrow keys step it, and a double-click puts it back.
 */
export function DialPanel({ name, dials, values, onChange, leaving = false }: Props) {
  return (
    <div className="dials" role="group" aria-label={`${name} dials`} data-leaving={leaving || undefined}>
      <div className="dials-title">{name}</div>
      {dials.map((d) => {
        if (d.kind === "group") return <div key={d.path} className="dials-group">{d.label}</div>;
        if (d.kind === "switch") {
          const on = getAt(values, d.path) === true;
          return (
            <button
              key={d.path}
              className="dial dial-switch"
              role="switch"
              aria-checked={on}
              onClick={() => onChange(d.path, !on)}
            >
              <span className="dial-label">{d.label}</span>
              <span className="dial-toggle" data-on={on || undefined} />
            </button>
          );
        }
        const v = getAt(values, d.path);
        return <SliderRow key={d.path} dial={d} value={typeof v === "number" ? v : d.initial} onChange={onChange} />;
      })}
    </div>
  );
}

const decimalsOf = (step: number) => Math.max(0, -Math.floor(Math.log10(step)));

function SliderRow({ dial, value, onChange }: { dial: Slider; value: number; onChange: Props["onChange"] }) {
  const fill = (value - dial.min) / (dial.max - dial.min);
  const set = (v: number) => {
    const next = snapToStep(v, dial);
    if (next !== value) onChange(dial.path, next);
  };
  const fromPointer = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set(dial.min + ((e.clientX - r.left) / r.width) * (dial.max - dial.min));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const by = e.shiftKey ? dial.step * 10 : dial.step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") set(value + by);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(value - by);
    else if (e.key === "Home") set(dial.min);
    else if (e.key === "End") set(dial.max);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="dial dial-slider"
      role="slider"
      tabIndex={0}
      aria-label={dial.label}
      aria-valuemin={dial.min}
      aria-valuemax={dial.max}
      aria-valuenow={value}
      style={{ "--fill": Math.min(1, Math.max(0, fill)) } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.dragging = "";
        fromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
      }}
      onPointerUp={(e) => delete e.currentTarget.dataset.dragging}
      onPointerCancel={(e) => delete e.currentTarget.dataset.dragging}
      onDoubleClick={() => set(dial.initial)}
      onKeyDown={onKeyDown}
    >
      <span className="dial-label">{dial.label}</span>
      <span className="dial-value">{value.toFixed(decimalsOf(dial.step))}</span>
    </div>
  );
}
