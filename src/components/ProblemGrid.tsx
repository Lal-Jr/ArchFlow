"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { PROBLEMS } from "@/lib/problems";
import { loadDesign } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";
import { ComponentIcon } from "./ComponentIcon";
import { colorFor } from "@/lib/catalog";

export function ProblemGrid() {
  // Serialized so the snapshot compares by value between renders.
  const snapshot = useSyncExternalStore(
    () => () => {},
    () => JSON.stringify(Object.fromEntries(PROBLEMS.map((p) => [p.slug, loadDesign(p.slug)?.bestScore ?? 0]))),
    () => "{}",
  );
  const scores = JSON.parse(snapshot) as Record<string, number>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PROBLEMS.map((p) => {
        const score = scores[p.slug] ?? 0;
        const types = [...new Set(p.solution.nodes.map((n) => n.type))].slice(0, 6);
        return (
          <Link
            key={p.slug}
            href={`/problems/${p.slug}`}
            className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <DifficultyBadge difficulty={p.difficulty} />
              {score > 0 && (
                <span className={`text-xs ${score === 100 ? "text-emerald-400" : "text-zinc-500"}`}>
                  {score === 100 ? "✓ Mastered" : `Best ${score}%`}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">{p.title}</h3>
            <p className="mb-5 text-sm text-zinc-400">{p.tagline}</p>
            <div className="mt-auto flex gap-1.5">
              {types.map((t) => (
                <span key={t} className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800/70">
                  <ComponentIcon type={t} size={14} color={colorFor(t)} />
                </span>
              ))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
