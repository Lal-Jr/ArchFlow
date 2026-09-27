"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CATALOG_BY_TYPE, colorFor, type ComponentType } from "@/lib/catalog";
import { ComponentIcon } from "./ComponentIcon";

export type ArchNodeData = {
  kind: ComponentType;
  label: string;
  /** Walkthrough emphasis: the step being explained, or an unrevealed step. */
  emphasis?: "current" | "dim";
};
export type ArchNodeType = Node<ArchNodeData, "arch">;

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function ArchNode({ data, selected }: NodeProps<ArchNodeType>) {
  const color = colorFor(data.kind);
  const current = data.emphasis === "current";
  return (
    <div
      className="group relative flex w-[176px] items-center gap-2.5 rounded-xl border bg-zinc-900 px-3 py-2.5 shadow-lg transition-all"
      style={{
        borderColor: selected || current ? color : "rgb(63 63 70)",
        boxShadow: current ? `0 0 0 3px ${color}40, 0 10px 30px -10px ${color}` : undefined,
        opacity: data.emphasis === "dim" ? 0.18 : 1,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}22` }}
      >
        <ComponentIcon type={data.kind} size={17} color={color} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium leading-tight text-zinc-100">{data.label}</div>
        <div className="truncate text-[11px] leading-tight text-zinc-500">{CATALOG_BY_TYPE[data.kind].label}</div>
      </div>
      {SIDES.map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={side}
          className="!h-2.5 !w-2.5 !border-2 !border-zinc-900 opacity-30 transition-opacity group-hover:opacity-100"
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

export const nodeTypes = { arch: ArchNode };
