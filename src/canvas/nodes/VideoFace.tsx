import { useState, type SyntheticEvent } from "react";
import type { Item } from "../../model/types";

type Props = {
  item: Item;
  /** Play it, silent and looping, over its still. */
  playing?: boolean;
  /** Opened big: it plays with a button for its sound. */
  big?: boolean;
};

/** Shows the playing video once it has a frame, so it never flashes empty over the still. */
const showWhenPlaying = (e: SyntheticEvent<HTMLVideoElement>) => {
  e.currentTarget.dataset.on = "";
};

/**
 * A video. At rest it is its still, a picture like any other, so a board or
 * a pile of them costs nothing to pan over; a small play mark says it moves.
 * It plays only when asked: under the pointer on the board, and opened big.
 */
export function VideoFace({ item, playing = false, big = false }: Props) {
  const [sound, setSound] = useState(false);
  const live = playing || big;
  return (
    <span className="face-video" data-big={big || undefined}>
      {item.posterSrc ? (
        <img src={item.posterSrc} alt={item.title ?? ""} draggable={false} />
      ) : (
        // No still yet (an older or hand-added video): its first frame stands in.
        <video src={`${item.src}#t=0.5`} muted playsInline preload="metadata" aria-hidden />
      )}
      {live && item.src && (
        <video
          className="face-video-play"
          src={item.src}
          autoPlay
          loop
          playsInline
          muted={!sound}
          onPlaying={showWhenPlaying}
          aria-label={item.title ?? "Video"}
        />
      )}
      {!live && (
        <span className="video-mark" aria-hidden>
          {/* Filled with a round-joined stroke, so its corners are soft. Set a
              little right of the box's centre, halfway to its centroid, so it
              looks centred. */}
          <svg viewBox="0 0 20 20">
            <path d="M7.9 7v6l5-3z" />
          </svg>
        </span>
      )}
      {big && (
        <button
          className="video-sound"
          aria-label={sound ? "Turn the sound off" : "Turn the sound on"}
          aria-pressed={sound}
          onClick={(e) => {
            e.stopPropagation();
            setSound((s) => !s);
          }}
        >
          {/* Drawn in the button's own 24 units, the whole glyph centred on 12,12 in both states. */}
          <svg viewBox="0 0 24 24" aria-hidden>
            <path className="video-sound-body" d="M5.5 10h2.5l3.5-3v10l-3.5-3H5.5z" />
            {sound ? <path d="M14.3 9.5a3.5 3.5 0 0 1 0 5M16.8 7.6a6.5 6.5 0 0 1 0 8.8" /> : <path d="M14.5 9.5l4 5M18.5 9.5l-4 5" />}
          </svg>
        </button>
      )}
    </span>
  );
}
