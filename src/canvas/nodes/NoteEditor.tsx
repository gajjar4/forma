import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  breakApart,
  changed,
  enter,
  hasBreak,
  joinBack,
  joinForward,
  toFields,
  toText,
  type Caret,
  type Fields,
  type Step,
} from "./noteFields";
import "../../styles/note-edit.css";

/**
 * Where it's written. Each field takes the classes of the text it stands in
 * for, so it reads the same as the note at rest.
 * - board: a note node (.note-head, then .note-body paragraphs).
 * - read: a note lifted in an opened stack (the read face, see Faces.tsx).
 */
type Look = "board" | "read";

type Props = {
  text: string;
  look: Look;
  /**
   * The new text, only if it changed: when writing pauses, when focus leaves,
   * or when the editor goes away. `again` is true for every save after the
   * first while writing, so all of one go at a note undoes as one step.
   */
  onSave: (text: string, again: boolean) => void;
  /** Focus left the editor. */
  onLeave?: () => void;
  /** Focus straight away, the caret here (or at the very end when null). */
  start?: Caret | null;
};

const FIELD = "note-field nodrag nowheel";
/** A pause this long in writing saves what's there, so a long note is never only in the editor. */
const PAUSE_MS = 1000;

/**
 * A note as you write it: the heading and every paragraph of the rest are
 * their own borderless fields, so the heading stays a heading and nothing
 * moves when writing starts or stops. Enter starts a paragraph, Backspace at
 * the start of one joins it to the one before. Someone else's change (the AI)
 * shows when you aren't writing.
 */
export function NoteEditor({ text, look, onSave, onLeave, start }: Props) {
  const [fields, setFields] = useState<Fields>(() => toFields(text));
  const [seen, setSeen] = useState(text);
  const [active, setActive] = useState(false);
  if (seen !== text) {
    setSeen(text);
    if (!active) setFields(toFields(text));
  }
  const root = useRef<HTMLElement>(null);
  /** What was last handed to onSave, so leaving twice saves once. */
  const saved = useRef<string | null>(null);
  /** Saved at least once since writing started. */
  const again = useRef(false);

  const fieldAt = (i: number) => root.current?.querySelectorAll("textarea")[i] ?? null;
  const place = (c: Caret) => {
    const el = fieldAt(c.field);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(c.at, c.at);
  };
  const apply = (step: Step) => {
    // The field the caret goes to takes focus first, so a field being joined
    // away never holds it (losing it would read as leaving the note).
    fieldAt(step.caret.field)?.focus({ preventScroll: true });
    flushSync(() => setFields(step.fields));
    place(step.caret);
  };

  const save = () => {
    const next = toText(fields);
    if (!changed(fields, text) || next === saved.current) return;
    saved.current = next;
    onSave(next, again.current);
    again.current = true;
  };

  // A pause in writing saves it. Every key sets the pause going again.
  const paused = useEffectEvent(() => save());
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(paused, PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [active, fields]);

  // Each field as tall as what's in it, in whole lines: scrollHeight rounds,
  // and a 19.5px line would come out half a pixel off. The box they sit in
  // keeps its scroll.
  useLayoutEffect(() => {
    const els = [...(root.current?.querySelectorAll("textarea") ?? [])];
    if (!els.length) return;
    const box = els[0].parentElement;
    const top = box?.scrollTop ?? 0;
    els.forEach((el) => (el.style.height = "auto"));
    const sizes = els.map((el) => [el.scrollHeight, parseFloat(getComputedStyle(el).height)]);
    els.forEach((el, i) => {
      const [scroll, line] = sizes[i];
      el.style.height = line > 0 ? `${Math.max(1, Math.round(scroll / line)) * line}px` : `${scroll}px`;
    });
    if (box) box.scrollTop = top;
  }, [fields]);

  const begin = useEffectEvent(() => {
    if (start === undefined) return;
    const last = fields.length - 1;
    place(start ?? { field: last, at: fields[last].length });
  });
  useLayoutEffect(() => begin(), []);

  // Taken away while still writing (the view closed under it): keep what's there.
  const away = useEffectEvent(() => save());
  useEffect(() => () => away(), []);

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>, i: number) => {
    const value = e.currentTarget.value;
    const next = fields.map((f, j) => (j === i ? value : f));
    if (hasBreak(value)) apply(breakApart(next, i, e.currentTarget.selectionStart));
    else setFields(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    // The board's keys stay out of it (Backspace never deletes the note).
    e.stopPropagation();
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: t } = el;
    const flat = s === t;
    const plain = !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
    const last = fields.length - 1;
    let step: Step | null = null;
    if (e.key === "Escape") return el.blur();
    if (e.key === "Enter" && !e.shiftKey) step = enter(fields, i, s, t);
    else if (e.key === "Backspace" && flat && s === 0) step = joinBack(fields, i);
    else if (e.key === "Delete" && flat && t === el.value.length) step = joinForward(fields, i);
    else if (plain && flat && (e.key === "ArrowUp" || e.key === "ArrowLeft") && s === 0 && i > 0) {
      step = { fields, caret: { field: i - 1, at: fields[i - 1].length } };
    } else if (plain && flat && (e.key === "ArrowDown" || e.key === "ArrowRight") && t === el.value.length && i < last) {
      step = { fields, caret: { field: i + 1, at: 0 } };
    }
    if (!step) return;
    e.preventDefault();
    apply(step);
  };

  const onBlur = (e: FocusEvent) => {
    if (root.current?.contains(e.relatedTarget as Node | null)) return;
    setActive(false);
    save();
    again.current = false;
    onLeave?.();
  };

  // A press on the sheet around the text writes on at the end.
  const onMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    e.preventDefault();
    const last = fields.length - 1;
    place({ field: last, at: fields[last].length });
  };

  const field = (value: string, i: number, className: string) => (
    <textarea
      key={i}
      className={`${className} ${FIELD}`}
      rows={1}
      value={value}
      placeholder={i === 0 ? "Note" : undefined}
      aria-label={i === 0 ? "Note heading" : `Paragraph ${i}`}
      spellCheck
      onChange={(e) => onChange(e, i)}
      onKeyDown={(e) => onKeyDown(e, i)}
    />
  );
  const [head, ...body] = fields;
  const handlers = { onFocus: () => setActive(true), onBlur };

  if (look === "board") {
    return (
      <div ref={(el) => void (root.current = el)} className="note-editor" {...handlers}>
        {field(head, 0, "note-head")}
        {body.map((p, j) => field(p, j + 1, "note-body"))}
      </div>
    );
  }
  return (
    <span
      ref={(el) => void (root.current = el)}
      className="face face-note face-read note-editor"
      onMouseDown={onMouseDown}
      {...handlers}
    >
      <span className="face-in">
        {field(head, 0, "face-note-head")}
        {body.length > 0 && <span className="face-note-body">{body.map((p, j) => field(p, j + 1, "note-para"))}</span>}
      </span>
    </span>
  );
}

/**
 * Where the caret would land for a press at `x`, `y` on a note at rest (its
 * shown text, `show`): the field under it and how far in. Null off the text.
 */
export function caretFromPoint(show: Element | null, x: number, y: number): Caret | null {
  if (!show) return null;
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const pos = doc.caretPositionFromPoint?.(x, y);
  const range = pos ? null : doc.caretRangeFromPoint?.(x, y);
  const node = pos?.offsetNode ?? range?.startContainer;
  const offset = pos?.offset ?? range?.startOffset ?? 0;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const block = node.parentElement?.closest(".note-head, .note-body");
  if (!block || block.parentElement !== show) return null;
  const field = Array.prototype.indexOf.call(show.children, block);
  // An empty heading shows "Note" in its place.
  const empty = field === 0 && block.hasAttribute("data-empty");
  return { field, at: empty ? 0 : offset };
}
