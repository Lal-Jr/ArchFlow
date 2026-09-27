"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CATALOG, CATEGORY_META, type Category, type ComponentType } from "@/lib/catalog";
import { DEFAULTS, ROLE } from "@/lib/sim/config";
import { fmtRps } from "@/lib/sim/format";
import { ComponentIcon } from "../ComponentIcon";

export const DND_TYPE = "application/archflow";

export function Palette({ onAdd }: { onAdd: (kind: ComponentType) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (c: (typeof CATALOG)[number]) =>
    !q || [c.label, c.examples, c.summary].some((t) => t.toLowerCase().includes(q));
  const groups = (Object.keys(CATEGORY_META) as Category[]).filter((cat) => CATALOG.some((c) => c.category === cat && matches(c)));
  return (
    <div className="p-3">
      <div className="relative mb-2">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, e.g. cache, Kafka, Redis"
          aria-label="Search components"
          className="w-full rounded-lg bg-wash py-2 pl-8 pr-3 text-sm outline-none ring-1 ring-transparent placeholder:text-ink-4 focus:bg-white focus:ring-ink"
        />
      </div>
      <p className="mb-3 px-2 text-xs text-ink-3">Drag onto the canvas, or click to add.</p>
      {groups.length === 0 && <p className="px-2 text-sm text-ink-3">No components match &ldquo;{query}&rdquo;.</p>}
      {groups.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider">{CATEGORY_META[cat].label}</div>
          {CATALOG.filter((c) => c.category === cat && matches(c)).map((c) => {
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
