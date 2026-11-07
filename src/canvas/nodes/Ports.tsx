import { Handle, Position, useNodeId } from "@xyflow/react";
import { hoverPort, leavePort } from "../gridFx";
import type { Side } from "../gridFx.math";

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/**
 * Four ports, one per side. Each is an invisible hit area at the side's
 * midpoint: what you see is a "+" the dot grid gathers there out of its own
 * dots when you hover the thing (see gridFx.scene.ts). Pull from any of them
 * to start a wire. Where the wire ends up is worked out from the positions,
 * so the port you pulled from only starts the gesture.
 */
export function Ports() {
  const id = useNodeId() ?? "";
  return (
    <>
      {SIDES.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={side}
          className="port"
          onMouseEnter={() => hoverPort(id, side as Side)}
          onMouseLeave={() => leavePort(id, side as Side)}
        />
      ))}
    </>
  );
}
