"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, Info, OctagonAlert, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import type { Compiled } from "@/lib/sim/engine";
import { fmtMs, fmtPct, fmtRps } from "@/lib/sim/format";
import { deriveInsights, type Severity } from "@/lib/sim/insights";
import { PATTERNS, offeredRps } from "@/lib/sim/traffic";
import { LineChart, type Series } from "./LineChart";
import { useSnapshot, type Simulation } from "./useSimulation";

/* --------------------------------- Control bar --------------------------------- */

// Log-scale slider: 0..100 → 10..50,000 rps.
const toRps = (v: number) => Math.round(10 ** (1 + (v / 100) * 3.7) / 10) * 10 || 10;
const toSlider = (rps: number) => ((Math.log10(Math.max(10, rps)) - 1) / 3.7) * 100;

export function SimBar({ sim }: { sim: Simulation }) {
  const snap = useSnapshot();
  const current = snap ? offeredRps(sim.pattern, sim.rps, snap.t) : sim.rps;
  return (
    <div className="absolute left-1/2 top-4 z-20 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 whitespace-nowrap rounded-[26px] bg-white p-1.5 shadow-[0_4px_16px_rgb(0_0_0/0.14)]">
      <button
        onClick={() => sim.setRunning(!sim.running)}
        className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-ink pl-3.5 pr-4 text-sm font-semibold text-white hover:bg-ink-2"
      >
        {sim.running ? <Pause size={15} fill="#fff" /> : <Play size={15} fill="#fff" />}
        {sim.running ? "Pause" : snap ? "Resume" : "Run traffic"}
      </button>

      <div className="mx-2 flex items-center gap-2.5">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={toSlider(sim.rps)}
          onChange={(e) => sim.setRps(toRps(Number(e.target.value)))}
          className="w-24"
          aria-label="Target traffic"
        />
        <div className="w-[76px] text-sm leading-none">
          <div className="font-semibold tabular-nums">{fmtRps(current)} rps</div>
          <div className="mt-0.5 text-[10px] text-ink-3">target {fmtRps(sim.rps)}</div>
        </div>
      </div>

      <div className="flex rounded-full bg-wash p-0.5">
        {PATTERNS.map((p) => (
          <button
            key={p.id}
            title={p.hint}
            onClick={() => sim.setPattern(p.id)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium ${
              sim.pattern === p.id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="ml-1 flex rounded-full bg-wash p-0.5">
        {[1, 4, 10].map((s) => (
          <button
            key={s}
            onClick={() => sim.setSpeed(s)}
            title={`${s}× simulation speed`}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium tabular-nums ${
              sim.speed === s ? "bg-ink text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <span className="ml-1 w-9 text-right text-xs tabular-nums text-ink-3">{snap ? `${Math.floor(snap.t)}s` : "0s"}</span>
      <button onClick={sim.reset} title="Reset simulation" className="rounded-full p-2 text-ink-2 hover:bg-wash hover:text-ink">
        <RotateCcw size={15} />
      </button>
    </div>
  );
}

/* --------------------------------- Metrics sheet -------------------------------- */

const INK = "#000000";

const KPIS: { key: string; label: string; unit: (n: number) => string; series: Series[]; caption?: string }[] = [
  {
    key: "throughput",
    label: "Throughput",
    unit: (n) => `${fmtRps(n)}/s`,
    series: [
      { key: "served", label: "Served", value: (p) => p.throughput, color: INK },
      { key: "offered", label: "Offered", value: (p) => p.offered, color: "#a6a6a6", dashed: true },
    ],
  },
  {
    key: "latency",
    label: "Avg latency",
    unit: fmtMs,
    caption: "End to end, from the client",
    series: [{ key: "lat", label: "Latency", value: (p) => p.latencyMs, color: INK }],
  },
  {
    key: "errors",
    label: "Error rate",
    unit: fmtPct,
    caption: "Timeouts, failures and 429s",
    series: [{ key: "err", label: "Errors", value: (p) => p.errorPct, color: INK }],
  },
  {
    key: "queue",
    label: "Queue depth",
    unit: (n) => fmtRps(n),
    caption: "Messages waiting in queues",
    series: [{ key: "q", label: "Queued", value: (p) => p.queueDepth, color: INK }],
  },
];

export function SimSheet() {
  const snap = useSnapshot();
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const current: Record<string, number> = snap
    ? { throughput: snap.throughputRps, latency: snap.latencyMs, errors: snap.errorPct, queue: snap.queueDepth }
    : {};

  return (
    <div className="absolute inset-x-4 bottom-4 z-20 rounded-2xl bg-white shadow-[0_-2px_24px_rgb(0_0_0/0.12)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="absolute -top-3 left-1/2 flex h-6 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-white text-ink-3 shadow hover:text-ink"
        aria-label={open ? "Collapse metrics" : "Expand metrics"}
      >
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {!snap ? (
        <div className="px-5 py-4 text-sm text-ink-3">
          Press <span className="font-semibold text-ink">Run traffic</span> to send requests through your design. Arrows point
          the way requests travel.
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-line">
          {KPIS.map((k) => {
            const v = current[k.key];
            const bad = (k.key === "errors" && v >= 1) || (k.key === "latency" && v >= 500);
            return (
              <div key={k.key} className="min-w-0 px-4 pb-2 pt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-ink-3">{k.label}</span>
                  {k.series.length > 1 && (
                    <span className="flex gap-2 text-[10px] text-ink-3">
                      {k.series.map((s) => (
                        <span key={s.key} className="flex items-center gap-1">
                          <svg width="12" height="2">
                            <line x1="0" x2="12" y1="1" y2="1" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "3 2" : undefined} />
                          </svg>
                          {s.label}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-semibold tracking-tight ${bad ? "text-bad" : ""}`}>{k.unit(v)}</div>
                {open && (
                  <>
                    <div className="mb-1 h-4 truncate text-[10px] text-ink-4">{k.caption}</div>
                    <LineChart data={snap.history} series={k.series} format={k.unit} hover={hover} onHover={setHover} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- Insights ----------------------------------- */

const SEV: Record<Severity, { Icon: typeof Info; cls: string; label: string }> = {
  critical: { Icon: OctagonAlert, cls: "text-bad", label: "Critical" },
  warning: { Icon: TriangleAlert, cls: "text-warn-ink", label: "Warning" },
  info: { Icon: Info, cls: "text-ink-2", label: "Note" },
  good: { Icon: CircleCheck, cls: "text-good", label: "Good" },
};

export function InsightsPanel({ compiled, onFocus }: { compiled: Compiled; onFocus: (id: string) => void }) {
  const snap = useSnapshot();
  const insights = snap ? deriveInsights(compiled, snap) : [];
  return (
    <div className="p-5">
      <h2 className="text-lg font-bold tracking-tight">Live insights</h2>
      <p className="mb-4 text-sm text-ink-3">
        {snap ? "What the simulator sees right now." : "Run traffic to see bottlenecks, backlogs and failures as they happen."}
      </p>
      <ul className="space-y-2">
        {insights.map((i) => {
          const s = SEV[i.severity];
          return (
            <li key={i.id}>
              <button
                disabled={!i.nodeId}
                onClick={() => i.nodeId && onFocus(i.nodeId)}
                className="w-full rounded-xl border border-line p-3 text-left enabled:hover:border-ink"
              >
                <div className="flex items-start gap-2">
                  <s.Icon size={16} className={`mt-0.5 shrink-0 ${s.cls}`} aria-label={s.label} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug">{i.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{i.detail}</p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {!snap && (
        <div className="mt-2 space-y-3 rounded-xl bg-wash p-4 text-xs leading-relaxed text-ink-2">
          <p>
            <span className="font-semibold text-ink">Try this:</span> run steady traffic, then switch to <em>Ramp</em> and watch
            which component turns red first.
          </p>
          <p>Select a node to change its replicas and capacity, or kill it to see what fails.</p>
        </div>
      )}
    </div>
  );
}
