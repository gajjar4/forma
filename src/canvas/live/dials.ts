// Dials: how a live card's component asks Forma for controls. The component
// sends its config once it has loaded; Forma draws the dials beside it while
// it's open and sends the values back whenever one changes. What it was last
// tuned to is kept on the item, in board.json. See FORMAT.md.
//
// The config is plain data, keyed by name:
//   spread: [1, 0.4, 1.8, 0.05]   a slider: default, min, max, step (optional)
//   loop: true                     a switch
//   spring: { stiffness: 420, … }  a group of dials (any object)

export type DialConfig = { [key: string]: unknown };
export type DialValues = { [key: string]: unknown };

/** One control, flattened out of the config. `path` is its keys joined by dots. */
export type Dial =
  | { kind: "slider"; path: string; label: string; min: number; max: number; step: number; initial: number }
  | { kind: "switch"; path: string; label: string; initial: boolean }
  | { kind: "group"; path: string; label: string };

/** "visualDuration" reads as "Visual duration". */
export function labelOf(key: string) {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Ranges for numbers given without one, by the names springs use. */
const KNOWN: Record<string, [number, number, number]> = {
  stiffness: [1, 1000, 1],
  damping: [1, 100, 1],
  mass: [0.1, 5, 0.1],
  visualDuration: [0.05, 2, 0.01],
  bounce: [0, 1, 0.01],
  duration: [0.05, 3, 0.01],
};

function stepFor(min: number, max: number) {
  const span = max - min;
  return span <= 1 ? 0.01 : span <= 10 ? 0.1 : 1;
}

function guessRange(key: string, v: number): [number, number, number] {
  if (KNOWN[key]) return KNOWN[key];
  const max = v === 0 ? 1 : Math.abs(v) * 3;
  const min = v < 0 ? -max : 0;
  return [min, max, stepFor(min, max)];
}

const isSlider = (v: unknown): v is [number, number, number, number?] =>
  Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === "number");
const isGroup = (v: unknown): v is DialConfig => !!v && typeof v === "object" && !Array.isArray(v);

/** Every control in the config, in order, groups before what's in them. Anything unreadable is left out. */
export function dialsOf(config: DialConfig, prefix = ""): Dial[] {
  const out: Dial[] = [];
  for (const [key, v] of Object.entries(config)) {
    if (key === "type") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const label = labelOf(key);
    if (isSlider(v)) {
      const [initial, min, max, step] = v;
      if (max > min) out.push({ kind: "slider", path, label, min, max, step: step ?? stepFor(min, max), initial });
    } else if (typeof v === "number") {
      const [min, max, step] = guessRange(key, v);
      out.push({ kind: "slider", path, label, min: Math.min(min, v), max: Math.max(max, v), step, initial: v });
    } else if (typeof v === "boolean") {
      out.push({ kind: "switch", path, label, initial: v });
    } else if (isGroup(v)) {
      const inner = dialsOf(v, path);
      if (inner.length) out.push({ kind: "group", path, label }, ...inner);
    }
  }
  return out;
}

/** Reads a value by its dotted path. */
export function getAt(values: DialValues, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (isGroup(o) ? o[k] : undefined), values);
}

/** A copy of the values with one changed. */
export function setAt(values: DialValues, path: string, value: unknown): DialValues {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...values, [head]: value };
  const inner = isGroup(values[head]) ? (values[head] as DialValues) : {};
  return { ...values, [head]: setAt(inner, rest.join("."), value) };
}

/**
 * The values the component starts with: its defaults, then anything saved
 * that still fits (a saved value for a dial it no longer has is let go, and
 * a saved number is kept inside its range). Keys the component sent that
 * aren't dials, like a spring's `type`, are passed through as they are.
 */
export function startValues(config: DialConfig, saved?: DialValues): DialValues {
  const out: DialValues = {};
  for (const [key, v] of Object.entries(config)) {
    const was = saved?.[key];
    if (isSlider(v)) {
      out[key] = typeof was === "number" ? Math.min(v[2], Math.max(v[1], was)) : v[0];
    } else if (typeof v === "number") {
      out[key] = typeof was === "number" ? was : v;
    } else if (typeof v === "boolean") {
      out[key] = typeof was === "boolean" ? was : v;
    } else if (isGroup(v)) {
      out[key] = startValues(v, isGroup(was) ? was : undefined);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Snaps a dragged number to its dial's step and range, without float dust. */
export function snapToStep(v: number, d: { min: number; max: number; step: number }) {
  const snapped = Math.round((v - d.min) / d.step) * d.step + d.min;
  const decimals = Math.max(0, -Math.floor(Math.log10(d.step)));
  return Number(Math.min(d.max, Math.max(d.min, snapped)).toFixed(decimals));
}

/** What a component sends: `{ forma: "dials", config, name? }`. */
export function readDialsMessage(data: unknown): { config: DialConfig; name?: string } | null {
  if (!data || typeof data !== "object") return null;
  const m = data as { forma?: unknown; config?: unknown; name?: unknown };
  if (m.forma !== "dials" || !isGroup(m.config)) return null;
  return { config: m.config, name: typeof m.name === "string" && m.name.trim() ? m.name : undefined };
}

/**
 * Hands a component its values: `{ forma: "values", values }`. The frame has
 * no origin of its own (it is sandboxed), so the target can only be "*".
 */
export function postValues(frame: HTMLIFrameElement, values: DialValues) {
  frame.contentWindow?.postMessage({ forma: "values", values }, "*");
}

/** Two sets of values the same, so an open and close without a change doesn't save. */
export const sameValues = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
