import { hostOf } from "../../model/items";
import { Favicon } from "./Faces";

/**
 * Where a thing came from, as that place's own small mark: the one icon on
 * board content, because it says something you can't see. Never what kind
 * of thing it is, and never beside a title.
 */
export function SourceMark({ url }: { url: string }) {
  return (
    <span className="source-mark" aria-label={`From ${hostOf(url)}`}>
      <Favicon url={url} />
    </span>
  );
}
