import type { Ref, SyntheticEvent } from "react";
import type { Item } from "../../model/types";
import { postValues } from "./dials";

/**
 * Only scripts: no same origin, so a component can't reach the app, the
 * project folder or this page, and no forms, popups or top navigation.
 */
export const LIVE_SANDBOX = "allow-scripts";

/**
 * Where a component runs. On the board (`card`) it is small and takes no
 * pointer, so it plays quietly on its own; opened big (`open`) it is the whole
 * thing. It reads this from its address: `#card` or `#open`.
 */
export type LiveMode = "card" | "open";

type Props = { item: Item; mode: LiveMode; className: string; ref?: Ref<HTMLIFrameElement> };

/** A live card's component, running in its own sandboxed frame. */
export function LiveFrame({ item, mode, className, ref }: Props) {
  // Shows the frame once its page has loaded, without a re-render, and hands
  // it what its dials were last tuned to.
  const onLoad = (e: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = e.currentTarget;
    frame.dataset.loaded = "";
    if (item.dials) postValues(frame, item.dials);
  };
  return (
    <iframe
      ref={ref}
      className={className}
      src={`${item.src}#${mode}`}
      sandbox={LIVE_SANDBOX}
      loading="lazy"
      aria-label={item.title ?? "Live card"}
      onLoad={onLoad}
    />
  );
}
