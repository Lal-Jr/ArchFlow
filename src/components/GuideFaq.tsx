"use client";

import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { FAQ } from "@/lib/guide";

export function GuideFaq() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = FAQ.map((g) => ({ ...g, items: g.items.filter((i) => !q || (i.q + " " + i.a).toLowerCase().includes(q)) })).filter(
    (g) => g.items.length,
  );
  return (
    <div>
      <div className="relative mb-6">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions, e.g. p99, arrows, undo, cost"
          aria-label="Search FAQ"
          className="w-full rounded-xl bg-wash py-3 pl-10 pr-4 outline-none ring-1 ring-transparent placeholder:text-ink-4 focus:bg-white focus:ring-ink"
        />
      </div>
      {groups.length === 0 && <p className="text-ink-3">No questions match &ldquo;{query}&rdquo;.</p>}
      <div className="space-y-8">
        {groups.map((g) => (
          <div key={g.group}>
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider">{g.group}</h3>
            <div className="divide-y divide-line border-y border-line">
              {g.items.map((i) => (
                <details key={i.q} className="group py-4" open={!!q}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                    {i.q}
                    <ChevronRight size={16} className="shrink-0 text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 max-w-3xl leading-relaxed text-ink-2">{i.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
