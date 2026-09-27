"use client";

import { useEffect, useState } from "react";
import { Check, Lightbulb, Target, X } from "lucide-react";
import { evaluate, snapshotCost, WARMUP_S, type Challenge, type ChallengeGoals } from "@/lib/challenges";
import { fmtMs, fmtPct, fmtRps, fmtUsd } from "@/lib/sim/format";
import { PATTERNS } from "@/lib/sim/traffic";
import { saveChallengeBest } from "@/lib/storage";
import { useSnapshot, type Simulation } from "./editor/useSimulation";

const FORMAT: Record<keyof ChallengeGoals, (n: number) => string> = {
  maxErrorPct: fmtPct,
  maxP99Ms: fmtMs,
  maxMonthlyCost: fmtUsd,
  maxFinalQueue: fmtRps,
};

export function ChallengePanel({ challenge, sim }: { challenge: Challenge; sim: Simulation }) {
  const snap = useSnapshot();
  const [hints, setHints] = useState(0);
  const pattern = PATTERNS.find((p) => p.id === challenge.traffic.pattern)!;

  // While running, score what has happened so far; once finished, the final result.
  const history = sim.finished?.history ?? snap?.history ?? [];
  const cost = sim.finished?.peakCost ?? snapshotCost(sim.sim, snap);
  const result = evaluate(challenge, history, cost);
  const done = !!sim.finished;
  const progress = Math.min(1, (snap?.t ?? 0) / challenge.durationS);

  useEffect(() => {
    if (!sim.finished) return;
    const r = evaluate(challenge, sim.finished.history, sim.finished.peakCost);
    saveChallengeBest(challenge.id, { passed: r.passed, cost: sim.finished.peakCost });
  }, [sim.finished, challenge]);

  return (
    <div className="space-y-6 p-5 text-sm">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-3">
          <Target size={13} /> Challenge
        </div>
        <h2 className="text-xl font-bold tracking-tight">{challenge.title}</h2>
        <p className="mt-2 leading-relaxed text-ink-2">{challenge.brief}</p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line text-xs">
        <div className="bg-white p-3">
          <div className="text-ink-3">Traffic</div>
          <div className="font-semibold">
            {pattern.label} · {fmtRps(challenge.traffic.rps)} rps
          </div>
        </div>
        <div className="bg-white p-3">
          <div className="text-ink-3">Duration</div>
          <div className="font-semibold">{challenge.durationS}s simulated</div>
        </div>
      </div>

      {done && (
        <div className={`rounded-xl p-4 ${result.passed ? "bg-good text-white" : "bg-ink text-white"}`}>
          <div className="text-lg font-bold">{result.passed ? "Challenge passed" : "Not quite"}</div>
          <p className="text-white/80">
            {result.passed
              ? `Your design held up for a peak cost of ${fmtUsd(cost)} a month. Can you do it cheaper?`
              : "Check which goals missed, change your design, then run it again."}
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-wider">Goals</h3>
          {!done && snap && <span className="text-xs text-ink-3">so far</span>}
        </div>
        {!done && snap && (
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <ul className="divide-y divide-line border-y border-line">
          {result.goals.map((g) => {
            const started = history.length > 0;
            const judged = g.key !== "maxP99Ms" || history.some((h) => h.t > WARMUP_S);
            const state = !started || !judged ? "pending" : g.passed ? "pass" : "fail";
            return (
              <li key={g.key} className="flex items-center gap-3 py-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    state === "pass" ? "bg-good text-white" : state === "fail" ? "bg-bad text-white" : "bg-line"
                  }`}
                  aria-label={state}
                >
                  {state === "pass" ? <Check size={12} strokeWidth={3} /> : state === "fail" ? <X size={12} strokeWidth={3} /> : null}
                </span>
                <span className="flex-1">{g.label}</span>
                <span className="tabular-nums">
                  {started && judged && <span className={`font-semibold ${state === "fail" ? "text-bad" : ""}`}>{FORMAT[g.key](g.value)} </span>}
                  <span className="text-ink-3">≤ {FORMAT[g.key](g.limit)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          Latency is judged after a {WARMUP_S}s warm-up. Cost is the peak during the run, so autoscaled replicas count.
          Per-replica specs and chaos are fixed; replicas, new components, autoscaling, retries and breakers are all yours.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider">Hints</h3>
        <ol className="space-y-2">
          {challenge.hints.slice(0, hints).map((h, i) => (
            <li key={i} className="flex gap-2 rounded-lg bg-wash p-3 text-xs leading-relaxed text-ink-2">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-warn-ink" />
              {h}
            </li>
          ))}
        </ol>
        {hints < challenge.hints.length && (
          <button onClick={() => setHints((n) => n + 1)} className="mt-2 text-xs font-semibold underline">
            {hints === 0 ? "Show a hint" : "Another hint"}
          </button>
        )}
      </div>
    </div>
  );
}
