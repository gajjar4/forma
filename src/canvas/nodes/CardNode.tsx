import type { Node, NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { useState } from "react";
import { docPicture, docTitle } from "../../model/docs";
import { asUrl, isMedia } from "../../model/items";
import type { CardData } from "../../model/types";
import { useCanvasUi } from "../context";
import { LiveCard } from "../live/LiveCard";
import { openLink } from "../openLink";
import { useZoomVar } from "../zoom";
import { ItemFace } from "./Faces";
import { fitInBox } from "./fit";
import { SourceMark } from "./SourceMark";
import { VideoFace } from "./VideoFace";
import { Ports } from "./Ports";

type CardNodeType = Node<CardData, "card">;

/**
 * A single loose item: a picture, a video, a document or a live card (a click
 * opens it big, like a stack; Canvas.tsx), or a link (double-click opens
 * it). Drop it on a stack to file it, or on another card or note to start a
 * stack.
 */
export function CardNode({ id, data, selected }: NodeProps<CardNodeType>) {
  const { dropTargetId, liveId } = useCanvasUi();
  useZoomVar();
  const { item } = data;
  const isLink = item.kind === "link";
  const isLive = item.kind === "live";
  const isDoc = item.kind === "doc";
  // A PDF shown as its first page is named under it, like a picture; other documents carry their name on the sheet.
  const title = isDoc ? docTitle(item) : item.title?.trim();
  const titled = (isMedia(item) || isLive || (isDoc && !!docPicture(item))) && !!title;
  const from = isMedia(item) && item.source ? asUrl(item.source) : null;
  // A video plays, silently, while the pointer is over it.
  const [hover, setHover] = useState(false);
  const isVideo = item.kind === "video";

  return (
    <motion.div
      className="card"
      data-kind={item.kind}
      data-titled={titled || undefined}
      data-selected={selected || undefined}
      data-target={dropTargetId === id || undefined}
      data-lifted={liveId === id || undefined}
      animate={{ scale: dropTargetId === id ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      onDoubleClick={isLink ? () => openLink(item.url ?? "") : undefined}
      title={isLink ? item.url : undefined}
    >
      {isLive ? (
        <LiveCard id={id} item={item} />
      ) : (
        <div
          className="card-media"
          style={fitInBox(item, isLink || isDoc ? 200 : 168)}
          onPointerEnter={isVideo ? () => setHover(true) : undefined}
          onPointerLeave={isVideo ? () => setHover(false) : undefined}
        >
          {isVideo ? <VideoFace item={item} playing={hover} /> : <ItemFace item={item} />}
          {from && <SourceMark url={from} />}
        </div>
      )}
      {titled && <div className="card-title">{title}</div>}
      <Ports />
    </motion.div>
  );
}
