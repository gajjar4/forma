import { useEffect, useEffectEvent, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { Item } from "../../model/types";
import { useCanvasUi } from "../context";
import { LiveFace } from "../nodes/Faces";
import { DialPanel } from "./DialPanel";
import { dialsOf, postValues, readDialsMessage, sameValues, setAt, startValues, type Dial, type DialValues } from "./dials";
import { LiveFrame } from "./frame";

/**
 * A live card opened big: its title above, the component running below and
 * taking the pointer. The still face sits under the frame until the page has
 * loaded, so it never flashes white. If the component asks for dials, they
 * sit beside it.
 *
 * A click inside hands the keyboard to the component. Once the pointer leaves
 * it, the keyboard comes back to the app, so Esc closes again.
 */
function giveBackKeys(e: PointerEvent<HTMLElement>) {
  const frame = e.currentTarget.querySelector("iframe");
  if (frame && document.activeElement === frame) {
    frame.blur();
    window.focus();
  }
}

/** `leaving`: it is being put back, so the dials step away first instead of shrinking with it. */
export function LiveStage({ item, leaving = false }: { item: Item; leaving?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const dials = useDials(item, frame);
  return (
    <>
      <span className="live-stage-title">{item.title?.trim() || "Prototype"}</span>
      <span className="live-stage" onPointerLeave={giveBackKeys}>
        <LiveFace />
        <LiveFrame ref={frame} item={item} mode="open" className="live-frame live-frame-open" />
      </span>
      {dials.panel && (
        <DialPanel
          name={dials.panel.name}
          dials={dials.panel.dials}
          values={dials.values}
          onChange={dials.change}
          leaving={leaving}
        />
      )}
    </>
  );
}

type Panel = { name: string; dials: Dial[] };

/**
 * The component's dials: read when it asks, every change sent back into the
 * frame, and what it was tuned to kept on the item once the card is put away.
 */
function useDials(item: Item, frame: RefObject<HTMLIFrameElement | null>) {
  const { updateItem } = useCanvasUi();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [values, setValues] = useState<DialValues>({});
  // The latest values, and whether you turned one, for saving on close. Only
  // written in event handlers.
  const latest = useRef<DialValues | null>(null);
  const turned = useRef(false);

  const send = (next: DialValues) => {
    latest.current = next;
    if (frame.current) postValues(frame.current, next);
  };

  const change = (path: string, value: unknown) => {
    const next = setAt(latest.current ?? values, path, value);
    turned.current = true;
    setValues(next);
    send(next);
  };

  const onMessage = useEffectEvent((e: MessageEvent) => {
    const el = frame.current;
    if (!el || e.source !== el.contentWindow) return;
    const asked = readDialsMessage(e.data);
    if (!asked) return;
    const dials = dialsOf(asked.config);
    if (!dials.length) return;
    const start = startValues(asked.config, item.dials as DialValues | undefined);
    setPanel({ name: asked.name ?? item.title?.trim() ?? "Dials", dials });
    setValues(start);
    send(start);
  });

  const save = useEffectEvent(() => {
    const tuned = latest.current;
    if (tuned && turned.current && !sameValues(tuned, item.dials)) updateItem(item.id, { dials: tuned });
  });

  useEffect(() => {
    const listen = (e: MessageEvent) => onMessage(e);
    window.addEventListener("message", listen);
    return () => {
      window.removeEventListener("message", listen);
      save();
    };
  }, []);

  return { panel, values, change };
}
