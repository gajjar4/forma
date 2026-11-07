import { useState, type SyntheticEvent } from "react";
import { faviconUrls, hostOf, linkLabel, noteParts } from "../../model/items";
import type { Item } from "../../model/types";
import { DocFace } from "./DocFace";
import { VideoFace } from "./VideoFace";

/**
 * The site's icon. Google sends a tiny grey globe when it has none, so anything
 * that small, or that fails to load, becomes the host's first letter.
 */
export function Favicon({ url }: { url: string }) {
  // Which address is being tried: the host's own icon first, then its main domain's.
  const [tried, setTried] = useState(0);
  const urls = faviconUrls(url);
  const next = () => setTried((t) => t + 1);
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth <= 16) next();
  };
  return (
    <span className="favicon">
      {tried >= urls.length ? (
        <span className="favicon-letter">{hostOf(url).charAt(0).toUpperCase() || "?"}</span>
      ) : (
        <img key={urls[tried]} src={urls[tried]} alt="" draggable={false} onLoad={onLoad} onError={next} />
      )}
    </span>
  );
}

/**
 * A link as a small card: icon, title, host. Sized in container units, so the
 * same card reads the same on the board, in a pile and in an opened stack.
 */
export function LinkFace({ item }: { item: Item }) {
  const { title, sub } = linkLabel(item);
  return (
    <span className="face face-link">
      <span className="face-in">
        <Favicon url={item.url ?? ""} />
        <span className="face-link-text">
          <span className="face-link-title">{title}</span>
          {sub && <span className="face-link-host">{sub}</span>}
        </span>
      </span>
    </span>
  );
}

/**
 * A note as a sheet of paper: its heading, then the first lines of the rest.
 * `read` lays it out at full size for reading, with nothing cut off.
 */
export function NoteFace({ item, read = false }: { item: Item; read?: boolean }) {
  const { head, body } = noteParts(item.text ?? "");
  return (
    <span className={read ? "face face-note face-read" : "face face-note"}>
      <span className="face-in">
        <span className="face-note-head">{head || "Note"}</span>
        {body.length > 0 && <span className="face-note-body">{body.join("\n\n")}</span>}
      </span>
    </span>
  );
}

/**
 * A live card at rest: a soft surface, nothing written on it (its title sits
 * under the card, like an image's). It is what shows in a pile, in an opened
 * stack, and on the board until the component runs.
 */
export function LiveFace() {
  return <span className="face face-live" />;
}

/** Whatever an item is, drawn to fill its box. */
export function ItemFace({ item, read }: { item: Item; read?: boolean }) {
  if (item.kind === "note") return <NoteFace item={item} read={read} />;
  if (item.kind === "live") return <LiveFace />;
  if (item.kind === "link") return <LinkFace item={item} />;
  if (item.kind === "video") return <VideoFace item={item} />;
  if (item.kind === "doc") return <DocFace item={item} />;
  return item.src ? <img src={item.src} alt={item.title ?? ""} draggable={false} /> : null;
}
