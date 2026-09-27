"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Flame, OctagonX, TriangleAlert } from "lucide-react";
import { CATALOG_BY_TYPE } from "@/lib/catalog";
import type { ArchNodeType } from "@/lib/graph";
import { resolveConfig, ROLE } from "@/lib/sim/config";
import type { NodeStatus } from "@/lib/sim/engine";
import { fmtMs, fmtPct, fmtRps } from "@/lib/sim/format";
import { ComponentIcon } from "../ComponentIcon";
import { useSnapshot } from "./useSimulation";

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

const BADGE: Partial<Record<NodeStatus, { label: string; cls: string; Icon: typeof Flame }>> = {
  hot: { label: "Hot", cls: "bg-warn text-ink", Icon: Flame },
  overloaded: { label: "Overloaded", cls: "bg-bad text-white", Icon: TriangleAlert },
  down: { label: "Down", cls: "bg-ink text-white", Icon: OctagonX },
};

const METER: Record<NodeStatus, string> = {
  idle: "bg-ink-4",
  ok: "bg-good",
  hot: "bg-warn",
  overloaded: "bg-bad",
  down: "bg-bad",
};

export function ArchNode({ id, data, selected }: NodeProps<ArchNodeType>) {
  const snap = useSnapshot();
  const m = snap?.nodes[id];
  const cfg = resolveConfig(data.kind, data.config);
  const role = ROLE[data.kind];
  const info = CATALOG_BY_TYPE[data.kind];
  const badge = m ? BADGE[m.status] : cfg.down ? BADGE.down : undefined;
  const down = cfg.down && role !== "source";
  const current = data.emphasis === "current";

  const spec =
    role === "source"
      ? data.kind === "scheduler"
        ? `${fmtRps(cfg.sourceRps)} jobs/s`
        : "Traffic source"
      : `${cfg.replicas} × ${fmtRps(cfg.capacity)}/s`;

  return (
    <div
      className={`group relative w-[208px] rounded-[10px] border bg-white transition-[box-shadow,opacity,border-color] ${
        down ? "bg-wash" : ""
      }`}
      style={{
        borderColor: selected || current ? "#000" : m?.status === "overloaded" ? "#e11900" : "#e2e2e2",
        boxShadow: current
          ? "0 0 0 3px #000, 0 12px 28px -8px rgb(0 0 0 / .35)"
          : selected
            ? "0 0 0 1px #000, 0 8px 20px -8px rgb(0 0 0 / .3)"
            : "0 1px 3px rgb(0 0 0 / .08)",
        opacity: data.emphasis === "dim" ? 0.22 : 1,
      }}
    >
      {badge && (
        <span
          className={`absolute -top-2.5 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
        >
          <badge.Icon size={11} strokeWidth={2.5} />
          {badge.label}
        </span>
      )}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${down ? "bg-ink-4" : "bg-ink"}`}
        >
          <ComponentIcon type={data.kind} size={17} color="#fff" />
        </div>
        <div className="min-w-0">
          <div className={`truncate text-[13px] font-semibold leading-tight ${down ? "text-ink-3 line-through" : ""}`}>
            {data.label}
          </div>
          <div className="truncate text-[11px] leading-tight text-ink-3">
            {info.label} · {spec}
          </div>
        </div>
      </div>

      {m && role !== "source" && m.status !== "idle" && (
        <div className="border-t border-line px-3 py-2">
          <div className="mb-1.5 flex items-baseline justify-between text-[11px] tabular-nums">
            <span className="font-semibold">{fmtRps(m.inRps)}/s</span>
            <span className="text-ink-3">
              {m.status === "down"
                ? "no response"
                : role === "queue"
                ? `${fmtRps(m.backlog)} queued`
                : m.throttleRps > 0.5
                  ? `${fmtPct((m.throttleRps / m.inRps) * 100)} rejected`
                  : fmtMs(m.ownMs)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${METER[m.status]}`}
              style={{ width: `${Math.min(100, (isFinite(m.utilization) ? m.utilization : 1) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {SIDES.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={side}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-ink opacity-0 transition-opacity group-hover:opacity-100"
        />
      ))}
    </div>
  );
}

export const nodeTypes = { arch: ArchNode };
