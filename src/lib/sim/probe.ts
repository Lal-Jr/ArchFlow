/**
 * Capacity probe: finds the highest steady load a design sustains within its service-level
 * objective, and which component gives out first above it. It runs the same engine headlessly,
 * and the engine has no randomness, so an identical design always measures the same.
 */
import { monthlyCost, ROLE } from "./config";
import { compile, initialState, tick, type SimEdge, type SimNode, type Snapshot } from "./engine";

/** What "sustains" means: error rate and p99 at steady state, and no queue that grows without bound. */
export const SLO = { maxErrorPct: 1, maxP99Ms: 500 };

const DT = 0.1;
/** Long enough for autoscaling (10s provisioning) and backlogs to settle. */
const RUN_S = 60;
/** The window judged at the end of each run. */
const WINDOW_S = 10;
const MAX_RPS = 1_000_000;
/** The overload used to test isolation: how each endpoint fares at this multiple of the ceiling. */
export const OVERLOAD_FACTOR = 2;

export type Verdict = "errors" | "latency" | "backlog";

export interface Limit {
  nodeId: string;
  label: string;
  /** Load on it at the first failing rate, as a fraction of its capacity. */
  utilization: number;
}

export interface ProbeResult {
  /** Highest steady rps that meets the SLO (0 if even light traffic fails). */
  ceilingRps: number;
  /** True when the design held at the search's upper bound. */
  capped: boolean;
  /** Why the first failing rate failed, and the component that gave out. */
  verdict: Verdict | null;
  limit: Limit | null;
  /** Endpoint that failed worst at the first failing rate, when the design has a request mix. */
  worstEndpoint: string | null;
  p99AtCeilingMs: number;
  /** Peak monthly cost while running at the ceiling (autoscaled replicas included). */
  costAtCeiling: number;
  /**
   * Isolation: how each endpoint fares at OVERLOAD_FACTOR × the ceiling. A design that shares one
   * pool fails every endpoint together; one that gives an endpoint its own path keeps it working.
   * Null without a request mix, or when there is no finite ceiling to overload.
   */
  overload: EndpointOutcome[] | null;
  fingerprint: string;
}

export interface EndpointOutcome {
  key: string;
  ok: boolean;
  errorPct: number;
  p99Ms: number;
}

/** Reports progress as the search runs: completed runs out of an estimate of the total. */
export type ProgressFn = (done: number, estimate: number) => void;

interface RunOutcome {
  ok: boolean;
  verdict: Verdict | null;
  snap: Snapshot;
  p99: number;
  peakCost: number;
  endpoints: EndpointOutcome[];
}

function run(nodes: SimNode[], g: ReturnType<typeof compile>, rps: number): RunOutcome {
  const st = initialState();
  const ticks = Math.round(RUN_S / DT);
  const windowStart = ticks - Math.round(WINDOW_S / DT);
  let offered = 0;
  let served = 0;
  let p99 = 0;
  let peakCost = 0;
  let queueAtWindow = 0;
  const perEndpoint = new Map<string, { offered: number; served: number; p99: number }>();
  let snap!: Snapshot;
  for (let i = 0; i < ticks; i++) {
    const judged = i >= windowStart;
    // Tail latency is the expensive part: only sample it once a simulated second, inside the window.
    snap = tick(g, st, DT, rps, { tail: judged && i % 10 === 9 });
    if (i === windowStart) queueAtWindow = snap.queueDepth;
    if (judged) {
      offered += snap.offeredRps;
      served += snap.throughputRps;
      if (i % 10 === 9) p99 = Math.max(p99, snap.p99Ms);
      for (const e of snap.endpoints) {
        const acc = perEndpoint.get(e.key) ?? { offered: 0, served: 0, p99: 0 };
        acc.offered += e.offeredRps;
        acc.served += e.throughputRps;
        if (i % 10 === 9) acc.p99 = Math.max(acc.p99, e.p99Ms);
        perEndpoint.set(e.key, acc);
      }
      peakCost = Math.max(peakCost, monthlyCost(nodes, Object.fromEntries(Object.entries(snap.nodes).map(([id, m]) => [id, m.replicas]))));
    }
  }
  const errorPct = offered > 0 ? (1 - served / offered) * 100 : 0;
  // A queue that keeps growing will run out eventually, however healthy the rest looks.
  const growth = snap.queueDepth - queueAtWindow;
  const verdict: Verdict | null =
    errorPct > SLO.maxErrorPct ? "errors" : p99 > SLO.maxP99Ms ? "latency" : growth > Math.max(1, rps * WINDOW_S * 0.002) ? "backlog" : null;
  const endpoints = [...perEndpoint].map(([key, e]) => {
    const err = e.offered > 0 ? (1 - e.served / e.offered) * 100 : 0;
    return { key, ok: err <= SLO.maxErrorPct && e.p99 <= SLO.maxP99Ms, errorPct: err, p99Ms: e.p99 };
  });
  return { ok: verdict == null, verdict, snap, p99, peakCost, endpoints };
}

/** The component that gave out: the most overloaded one, or the queue that is backing up. */
function findLimit(g: ReturnType<typeof compile>, snap: Snapshot, verdict: Verdict | null): Limit | null {
  let best: Limit | null = null;
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    const m = snap.nodes[id];
    if (!m || ROLE[n.kind] === "source") continue;
    if (verdict === "backlog" && ROLE[n.kind] !== "queue") continue;
    const u = m.status === "down" ? Infinity : m.rejectRps > 0 && m.inRps > 0 ? m.rejectRps / m.inRps + 1 : m.utilization;
    if (!best || u > best.utilization) best = { nodeId: id, label: n.label, utilization: u };
  }
  return best;
}

/** FNV-1a over the parts of a design the engine reads — positions and names don't count. */
export function fingerprint(nodes: SimNode[], edges: SimEdge[]): string {
  const canon = JSON.stringify([
    [...nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => [n.id, n.kind, Object.entries(n.config).sort(([a], [b]) => a.localeCompare(b)), n.endpoints ?? [], n.serves ?? []]),
    [...edges].map((e) => [e.source, e.target, e.ratio ?? null]).sort((a, b) => String(a).localeCompare(String(b))),
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Rounds down to three significant figures, so the reported ceiling is never one the design fails. */
const floor3 = (n: number) => {
  if (n < 100) return Math.floor(n);
  const p = 10 ** (Math.floor(Math.log10(n)) - 2);
  return Math.floor(n / p) * p;
};

export function probeCapacity(nodes: SimNode[], edges: SimEdge[], onProgress?: ProgressFn): ProbeResult {
  const g = compile(nodes, edges);
  const print = fingerprint(nodes, edges);
  const empty = { ceilingRps: 0, capped: false, p99AtCeilingMs: 0, costAtCeiling: monthlyCost(nodes), overload: null, fingerprint: print };
  // Doubling from 100 to the ceiling, ~7 bisection steps, the ceiling and the overload run.
  let runs = 0;
  let estimate = 12;
  const measure = (rps: number) => {
    const o = run(nodes, g, rps);
    runs++;
    estimate = Math.max(estimate, runs + 1);
    onProgress?.(runs, estimate);
    return o;
  };
  if (!nodes.some((n) => n.kind === "client")) return { ...empty, verdict: null, limit: null, worstEndpoint: null };

  const worst = (snap: Snapshot) =>
    snap.endpoints.length ? [...snap.endpoints].sort((a, b) => b.errorPct - a.errorPct || b.p99Ms - a.p99Ms)[0].key : null;

  // Even a trickle fails: something is down, misrouted or unbound.
  const floor = measure(1);
  if (!floor.ok) {
    return { ...empty, verdict: floor.verdict, limit: findLimit(g, floor.snap, floor.verdict), worstEndpoint: worst(floor.snap) };
  }

  // Double until something gives, then bisect to ~1%.
  let lo = 1;
  let good = floor;
  let hi = 0;
  let bad: RunOutcome | null = null;
  for (let r = 100; r <= MAX_RPS; r *= 2) {
    const o = measure(r);
    if (o.ok) {
      lo = r;
      good = o;
    } else {
      hi = r;
      bad = o;
      break;
    }
  }
  if (!bad) {
    return {
      ceilingRps: lo,
      capped: true,
      verdict: null,
      limit: null,
      worstEndpoint: null,
      p99AtCeilingMs: good.p99,
      costAtCeiling: good.peakCost,
      overload: null,
      fingerprint: print,
    };
  }
  // Once the ceiling is bracketed, the rest of the search length is known.
  estimate = runs + Math.ceil(Math.log2((hi - lo) / hi / 0.01)) + 3;
  while ((hi - lo) / hi > 0.01) {
    const mid = (lo + hi) / 2;
    const o = measure(mid);
    if (o.ok) {
      lo = mid;
      good = o;
    } else {
      hi = mid;
      bad = o;
    }
  }
  const ceiling = floor3(lo);
  const atCeiling = ceiling === lo ? good : measure(ceiling);
  const overload = ceiling > 0 && good.endpoints.length > 1 ? measure(ceiling * OVERLOAD_FACTOR).endpoints : null;
  return {
    ceilingRps: ceiling,
    capped: false,
    verdict: bad.verdict,
    limit: findLimit(g, bad.snap, bad.verdict),
    worstEndpoint: worst(bad.snap),
    p99AtCeilingMs: atCeiling.p99,
    costAtCeiling: atCeiling.peakCost,
    overload,
    fingerprint: print,
  };
}
