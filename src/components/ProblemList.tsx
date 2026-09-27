"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { PROBLEMS } from "@/lib/problems";
import { loadBest } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";
import { ComponentIcon } from "./ComponentIcon";

export function ProblemList() {
  // Serialized so the snapshot compares by value between renders.
  const snapshot = useSyncExternalStore(
    () => () => {},
    () => JSON.stringify(Object.fromEntries(PROBLEMS.map((p) => [p.slug, loadBest(p.slug)]))),
    () => "{}",
  );
  const scores = JSON.parse(snapshot) as Record<string, number>;

  return (
    <ul className="divide-y divide-line border-y border-line">
      {PROBLEMS.map((p, i) => {
        const score = scores[p.slug] ?? 0;
        const types = [...new Set(p.solution.nodes.map((n) => n.type))].slice(0, 5);
        return (
          <li key={p.slug}>
            <Link href={`/problems/${p.slug}`} className="group grid grid-cols-[40px_1fr_auto] items-center gap-4 py-5 sm:grid-cols-[48px_1fr_160px_120px_auto]">
              <span className="font-mono text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className="block text-lg font-bold tracking-tight group-hover:underline">{p.title}</span>
                <span className="block text-sm text-ink-3">{p.tagline}</span>
              </span>
              <span className="hidden gap-1 sm:flex">
                {types.map((t) => (
                  <span key={t} className="flex h-7 w-7 items-center justify-center rounded-md bg-ink">
                    <ComponentIcon type={t} size={13} color="#fff" />
                  </span>
                ))}
              </span>
              <span className="hidden sm:block">
                <DifficultyBadge difficulty={p.difficulty} />
                {score > 0 && (
                  <span className={`mt-1 block text-xs font-medium ${score === 100 ? "text-good" : "text-ink-3"}`}>
                    {score === 100 ? "✓ Mastered" : `Best ${score}%`}
                  </span>
                )}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wash transition-colors group-hover:bg-ink group-hover:text-white">
                <ArrowRight size={18} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
