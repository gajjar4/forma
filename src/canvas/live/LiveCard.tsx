import { useRef, type CSSProperties } from "react";
import { liveSize } from "../../model/items";
import type { Item } from "../../model/types";
import { LiveFace } from "../nodes/Faces";
import { LiveFrame } from "./frame";
import { useLiveRun } from "./runner";

type Props = {
  /** The card node it sits on. */
  id: string;
  item: Item;
};

/**
 * A live card on the board. It runs its component only while you look at it
 * (see policy.ts), in its quiet card mode, and the board keeps every pointer:
 * the frame takes none, so the card drags, snaps and stacks like any other.
 * A click opens it big, the way a click opens a stack.
 */
export function LiveCard({ id, item }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const running = useLiveRun(id, ref);
  const { w, h } = liveSize(item);

  return (
    <div className="card-media live" ref={ref} style={{ width: w, height: h } as CSSProperties}>
      <LiveFace />
      {running && <LiveFrame item={item} mode="card" className="live-frame" />}
    </div>
  );
}
