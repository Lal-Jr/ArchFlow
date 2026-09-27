"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { CHALLENGES } from "@/lib/challenges";
import { fmtMs, fmtPct, fmtRps, fmtUsd } from "@/lib/sim/format";
import { PATTERNS } from "@/lib/sim/traffic";
import { loadChallengeBest } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";

export function ChallengeList() {
  // Serialized so the snapshot compares by value between renders.
  const snapshot = useSyncExternalStore(
    () => () => {},
    () => JSON.stringify(Object.fromEntries(CHALLENGES.map((c) => [c.id, loadChallengeBest(c.id)]))),
    () => "{}",
  );
  const best = JSON.parse(snapshot) as Record<string, { passed: boolean; cost: number } | null>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CHALLENGES.map((c) => {
        const b = best[c.id];
        return (
          <Link
            key={c.id}
            href={`/challenges/${c.id}`}
            className="group flex flex-col rounded-2xl border border-line p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4 flex items-center justify-between">
              <DifficultyBadge difficulty={c.difficulty} />
              {b?.passed && (
                <span className="rounded-full bg-good-wash px-2.5 py-0.5 text-xs font-semibold text-good">
                  ✓ Passed · {fmtUsd(b.cost)}/mo
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold tracking-tight group-hover:underline">{c.title}</h3>
            <p className="mb-5 text-ink-2">{c.tagline}</p>
            <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4 text-xs">
              <div>
                <dt className="text-ink-3">Traffic</dt>
                <dd className="font-semibold">
                  {PATTERNS.find((p) => p.id === c.traffic.pattern)!.label} {fmtRps(c.traffic.rps)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Goals</dt>
                <dd className="font-semibold">
                  ≤{fmtPct(c.goals.maxErrorPct)} err · p99 ≤{fmtMs(c.goals.maxP99Ms)}
                </dd>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <dt className="text-ink-3">Budget</dt>
                  <dd className="font-semibold">{fmtUsd(c.goals.maxMonthlyCost)}/mo</dd>
                </div>
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </div>
            </dl>
          </Link>
        );
      })}
    </div>
  );
}
