"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { FlowEdgeType } from "@/lib/graph";
import type { NodeStatus } from "@/lib/sim/engine";
import { fmtRps } from "@/lib/sim/format";
import { useSnapshot } from "./useSimulation";

const STROKE: Record<NodeStatus, string> = {
  idle: "#a6a6a6",
  ok: "#000000",
  hot: "#d99a00",
  overloaded: "#e11900",
  down: "#e11900",
};

export function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, selected } = props;
  const snap = useSnapshot();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const m = snap?.edges[id];
  const ignored = snap?.ignoredEdges.includes(id);
  const flowing = !!m && m.rps > 0.05;
  const color = flowing ? STROKE[m.status] : data?.highlight ? "#000000" : "#8f8f8f";
  const width = flowing ? Math.min(5, 1.5 + Math.log10(m.rps + 1) * 0.8) : data?.highlight ? 2.5 : 1.5;
  // More traffic → more dots, capped so busy edges stay legible.
  const dots = flowing ? Math.min(6, Math.max(1, Math.ceil(Math.log10(m.rps + 1) * 1.6))) : 0;
  const dur = 1.6;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className="af-edge-path"
        style={{
          stroke: selected ? "#276ef1" : color,
          strokeWidth: width,
          strokeDasharray: ignored || m?.status === "down" ? "6 5" : undefined,
          transition: "stroke 300ms, stroke-width 300ms",
        }}
      />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} r={3.5} fill={color} stroke="#fff" strokeWidth={2}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} begin={`${(i * dur) / dots}s`} />
        </circle>
      ))}
      {(flowing || data?.label) && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan pointer-events-none absolute rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
              flowing ? "bg-ink text-white" : "border border-line-2 bg-white text-ink-2"
            }`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {flowing ? `${fmtRps(m.rps)}/s` : data?.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { flow: FlowEdge };
