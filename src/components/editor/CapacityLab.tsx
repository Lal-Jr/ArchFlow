"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Gauge, Plus, X } from "lucide-react";
import type { SimEdge, SimNode } from "@/lib/sim/engine";
import { fmtMs, fmtRps, fmtUsd } from "@/lib/sim/format";
import { fingerprint, OVERLOAD_FACTOR, probeCapacity, SLO, type ProbeResult } from "@/lib/sim/probe";
import type { ProbeMessage, ProbeRequest } from "@/lib/sim/probe.worker";
import { loadBenchmarks, saveBenchmarks, type Benchmark } from "@/lib/storage";

const VERDICT: Record<NonNullable<ProbeResult["verdict"]>, string> = {
  errors: "errors above 1%",
  latency: `p99 above ${fmtMs(SLO.maxP99Ms)}`,
  backlog: "a queue that never drains",
};

/** Dollars per month for each 1,000 rps the design sustains — the number that makes cheap and fast comparable. */
const perK = (cost: number, rps: number) => (rps > 0 ? fmtUsd((cost / rps) * 1000) : "—");

/**
 * Measures how much steady traffic the design sustains and what gives out first, then lets you keep
 * the result and compare it against other versions of the design.
 */
export function CapacityLab({
  sim,
  storageKey,
  onFocus,
}: {
  sim: { nodes: SimNode[]; edges: SimEdge[] };
  storageKey: string;
  onFocus: (id: string) => void;
}) {
  const current = useMemo(() => fingerprint(sim.nodes, sim.edges), [sim]);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => worker.current?.terminate(), []);
  // The editor only renders in the browser, so storage can be read up front.
  const [bench, setBench] = useState<Benchmark[]>(() => loadBenchmarks(storageKey));
  const persist = (list: Benchmark[]) => {
    setBench(list);
    saveBenchmarks(storageKey, list);
  };

  const measure = () => {
    setBusy(true);
    setProgress(0);
    const id = ++requestId.current;
    const done = (r: ProbeResult) => {
      if (id !== requestId.current) return;
      setResult(r);
      setBusy(false);
    };
    try {
      // The probe runs dozens of headless simulations; a worker keeps the canvas and controls responsive meanwhile.
      worker.current ??= new Worker(new URL("../../lib/sim/probe.worker.ts", import.meta.url));
      worker.current.onmessage = ({ data }: MessageEvent<ProbeMessage>) => {
        if (data.id !== requestId.current) return;
        if ("result" in data) done(data.result);
        else setProgress(data.progress);
      };
      worker.current.postMessage({ id, nodes: sim.nodes, edges: sim.edges } satisfies ProbeRequest);
    } catch {
      // No worker support: measure on the main thread after "Measuring…" has painted.
      setTimeout(() => done(probeCapacity(sim.nodes, sim.edges)), 20);
    }
  };

  const stale = result && result.fingerprint !== current;
  const saved = result && bench.some((b) => b.fingerprint === result.fingerprint);
  const keep = () => {
    if (!result) return;
    const n = bench.length ? Math.max(...bench.map((b) => Number(b.label.match(/^Build (\d+)$/)?.[1] ?? 0))) + 1 : 1;
    persist([
      ...bench,
      {
        id: `${result.fingerprint}-${bench.length}`,
        label: `Build ${n}`,
        fingerprint: result.fingerprint,
        ceilingRps: result.ceilingRps,
        capped: result.capped,
        limit: result.limit?.label ?? null,
        costAtCeiling: result.costAtCeiling,
        ...(result.overload ? { held: result.overload.filter((e) => e.ok).length, endpoints: result.overload.length } : {}),
        at: Date.now(),
      },
    ]);
  };
  const top = Math.max(1, ...bench.map((b) => b.ceilingRps), result?.ceilingRps ?? 0);

  return (
    <section className="mb-5 rounded-xl border border-line p-4" data-tour="capacity">
      <div className="mb-1 flex items-center gap-2">
        <Gauge size={16} />
        <h2 className="font-bold tracking-tight">Capacity</h2>
        <span className="ml-auto font-mono text-[10px] text-ink-4" title="Build fingerprint: identical designs always measure the same">
          #{current}
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-ink-3">
        The most steady traffic this design sustains with under {SLO.maxErrorPct}% errors and p99 under {fmtMs(SLO.maxP99Ms)}.
        The simulation has no randomness, so the same build always gets the same number.
      </p>

      {result && (
        <div className={`mb-3 rounded-lg bg-wash p-3 ${stale ? "opacity-50" : ""}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {result.capped ? "≥ " : ""}
              {fmtRps(result.ceilingRps)}
            </span>
            <span className="text-sm text-ink-3">rps sustained</span>
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            {result.limit && (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-ink-3">{result.ceilingRps > 0 ? "Gives out first" : "Fails at any load"}</dt>
                <dd className="text-right">
                  <button onClick={() => onFocus(result.limit!.nodeId)} className="font-semibold underline-offset-2 hover:underline">
                    {result.limit.label}
                  </button>
                  {result.verdict && <span className="text-ink-3"> · {VERDICT[result.verdict]}</span>}
                </dd>
              </div>
            )}
            {result.worstEndpoint && (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">Worst endpoint</dt>
                <dd className="font-mono">{result.worstEndpoint}</dd>
              </div>
            )}
            {result.ceilingRps > 0 && (
              <>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-3">p99 at the ceiling</dt>
                  <dd className="tabular-nums">{fmtMs(result.p99AtCeilingMs)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-3">Cost per 1k rps</dt>
                  <dd className="tabular-nums">
                    {perK(result.costAtCeiling, result.ceilingRps)}
                    <span className="text-ink-3">/mo</span>
                  </dd>
                </div>
              </>
            )}
          </dl>
          {result.overload && (
            <div className="mt-3 border-t border-line pt-2">
              <div
                className="mb-1 text-[11px] font-semibold"
                title="Isolation: how each endpoint fares when the whole design is pushed past its ceiling. Endpoints on their own path keep working; a shared pool fails them all together."
              >
                At {OVERLOAD_FACTOR}× this load
              </div>
              <ul className="space-y-0.5 text-xs">
                {result.overload.map((e) => (
                  <li key={e.key} className="flex items-center gap-1.5">
                    {e.ok ? <Check size={12} className="shrink-0 text-good" /> : <X size={12} className="shrink-0 text-bad" />}
                    <span className="min-w-0 truncate font-mono" title={e.key}>
                      {e.key}
                    </span>
                    <span className={`ml-auto shrink-0 tabular-nums ${e.ok ? "text-ink-3" : "text-bad"}`}>
                      {e.ok ? "keeps working" : e.errorPct > SLO.maxErrorPct ? `${Math.round(e.errorPct)}% errors` : `p99 ${fmtMs(e.p99Ms)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stale && <p className="mt-2 text-xs font-medium text-ink-2">The design changed since. Measure again.</p>}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={measure}
          disabled={busy || sim.nodes.length === 0}
          className="flex-1 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink-2 disabled:opacity-50"
        >
          {busy ? `Measuring… ${Math.round(progress * 100)}%` : result && !stale ? "Measure again" : "Measure capacity"}
        </button>
        {result && !stale && !saved && (
          <button onClick={keep} className="flex items-center gap-1 rounded-lg border border-line-2 px-3 text-sm font-medium hover:border-ink">
            <Plus size={14} /> Compare
          </button>
        )}
      </div>

      {bench.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider">Compared builds</h3>
            <span className="text-[10px] text-ink-3">rps · $/mo per 1k rps</span>
          </div>
          <ul className="space-y-2">
            {bench.map((b) => (
              <li key={b.id} className="group">
                <div className="flex items-center gap-2 text-xs">
                  <input
                    value={b.label}
                    onChange={(e) => persist(bench.map((x) => (x.id === b.id ? { ...x, label: e.target.value.slice(0, 40) } : x)))}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label="Build name"
                    className={`min-w-0 flex-1 truncate rounded bg-transparent font-semibold outline-none focus:bg-wash ${b.fingerprint === current ? "text-accent-ink" : ""}`}
                  />
                  <span className="tabular-nums">
                    {b.capped ? "≥" : ""}
                    {fmtRps(b.ceilingRps)}
                  </span>
                  <span className="w-14 text-right tabular-nums text-ink-3">{perK(b.costAtCeiling, b.ceilingRps)}</span>
                  <button
                    onClick={() => persist(bench.filter((x) => x.id !== b.id))}
                    aria-label={`Remove ${b.label}`}
                    className="text-ink-4 opacity-0 hover:text-bad group-hover:opacity-100 focus:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${b.fingerprint === current ? "bg-accent" : "bg-ink"}`}
                    style={{ width: `${(b.ceilingRps / top) * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] text-ink-3">
                  <span>{b.limit && `limited by ${b.limit}`}</span>
                  {b.endpoints != null && (
                    <span title={`Endpoints that keep working at ${OVERLOAD_FACTOR}× the ceiling`}>
                      {b.held}/{b.endpoints} endpoints hold at {OVERLOAD_FACTOR}×
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
