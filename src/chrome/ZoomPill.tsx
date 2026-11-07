import { useReactFlow, useViewport } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";

/** Zoom level, with steps either side. Click the number to fit everything. */
export function ZoomPill() {
  const { zoom } = useViewport();
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="zoom chrome">
      <button className="zoom-step" aria-label="Zoom out" onClick={() => zoomOut({ duration: 200 })}>
        <Minus aria-hidden />
      </button>
      <button className="zoom-level" aria-label="Fit everything" onClick={() => fitView({ padding: 0.18, duration: 500 })}>
        {Math.round(zoom * 100)}%
      </button>
      <button className="zoom-step" aria-label="Zoom in" onClick={() => zoomIn({ duration: 200 })}>
        <Plus aria-hidden />
      </button>
    </div>
  );
}
