"use client";

import { CATALOG, CATEGORY_META, type Category, type ComponentType } from "@/lib/catalog";
import { DEFAULTS, ROLE } from "@/lib/sim/config";
import { fmtRps } from "@/lib/sim/format";
import { ComponentIcon } from "../ComponentIcon";

export const DND_TYPE = "application/archflow";

export function Palette({ onAdd }: { onAdd: (kind: ComponentType) => void }) {
  const groups = Object.keys(CATEGORY_META) as Category[];
  return (
    <div className="p-3">
      <p className="mb-3 px-2 text-xs text-ink-3">Drag onto the canvas, or click to add.</p>
      {groups.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider">{CATEGORY_META[cat].label}</div>
          {CATALOG.filter((c) => c.category === cat).map((c) => {
            const d = DEFAULTS[c.type];
            return (
              <button
                key={c.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_TYPE, c.type);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onAdd(c.type)}
                title={c.summary}
                className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-wash active:cursor-grabbing"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink">
                  <ComponentIcon type={c.type} size={14} color="#fff" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-tight">{c.label}</span>
                  <span className="block text-[11px] leading-tight text-ink-3">
                    {ROLE[c.type] === "source" ? "Traffic source" : `${fmtRps(d.replicas * d.capacity)}/s default`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
