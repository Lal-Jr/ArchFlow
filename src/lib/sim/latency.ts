/**
 * Discrete latency distributions, used to estimate tail latency (p95 / p99).
 *
 * A distribution is a list of (ms, probability) points summing to 1. Paths through
 * the graph combine them: sequential calls convolve, alternative paths mix. After
 * each step the list is compressed onto a fixed probability grid that is denser in
 * the tail, so p99 stays accurate while the lists stay small.
 */

export type Dist = { v: number; p: number }[];

export const point = (v: number): Dist => [{ v, p: 1 }];

// Exponential quantile bins, finer toward the tail so p95 / p99 land on their own bins.
// Each has its probability mass and the -ln(1 - q) factor at the bin's middle quantile.
const EXP_EDGES = [0, 0.5, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.999, 1];
const EXP_BINS = EXP_EDGES.slice(1).map((hi, i) => {
  const lo = EXP_EDGES[i];
  return { p: hi - lo, f: -Math.log(1 - (lo + hi) / 2) };
});
const EXP_MEAN = EXP_BINS.reduce((a, b) => a + b.p * b.f, 0);

/**
 * A component's own latency: half its base latency is fixed work, and the rest
 * (including queueing delay) is exponentially distributed around the mean.
 */
export function ownLatency(meanMs: number, baseMs: number): Dist {
  const fixed = Math.min(meanMs, baseMs * 0.5);
  const variable = meanMs - fixed;
  if (variable <= 0) return point(meanMs);
  return EXP_BINS.map((b) => ({ v: fixed + (variable * b.f) / EXP_MEAN, p: b.p }));
}

const GRID = [
  0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.94, 0.95,
  0.96, 0.97, 0.975, 0.98, 0.985, 0.99, 0.993, 0.996, 0.998, 0.999, 1,
];

/** Merges points into probability buckets (dense in the tail); each keeps its weighted mean. */
export function compress(d: Dist): Dist {
  const sorted = d.filter((x) => x.p > 0).sort((a, b) => a.v - b.v);
  const total = sorted.reduce((a, x) => a + x.p, 0);
  if (total <= 0) return point(0);
  const out: Dist = [];
  let cum = 0;
  let g = 0;
  let bucketP = 0;
  let bucketV = 0;
  for (const x of sorted) {
    const p = x.p / total;
    cum += p;
    bucketP += p;
    bucketV += p * x.v;
    while (g < GRID.length - 1 && cum >= GRID[g] - 1e-12) {
      if (bucketP > 0) out.push({ v: bucketV / bucketP, p: bucketP });
      bucketP = 0;
      bucketV = 0;
      g++;
    }
  }
  if (bucketP > 1e-12) out.push({ v: bucketV / bucketP, p: bucketP });
  return out;
}

/** Sum of two independent latencies. */
export function convolve(a: Dist, b: Dist): Dist {
  const out: Dist = [];
  for (const x of a) for (const y of b) out.push({ v: x.v + y.v, p: x.p * y.p });
  return compress(out);
}

/** Weighted mixture; weights may sum to less than 1, with the remainder at 0ms. */
export function mix(parts: { w: number; d: Dist }[]): Dist {
  const out: Dist = [];
  let used = 0;
  for (const { w, d } of parts) {
    if (w <= 0) continue;
    used += w;
    for (const x of d) out.push({ v: x.v, p: x.p * w });
  }
  if (used < 1) out.push({ v: 0, p: 1 - used });
  return compress(out);
}

/** Scales every latency — e.g. a call made `k` times in a row, or retried attempts. */
export const scale = (d: Dist, k: number): Dist => d.map((x) => ({ v: x.v * k, p: x.p }));

export function quantile(d: Dist, q: number): number {
  const sorted = [...d].sort((a, b) => a.v - b.v);
  let cum = 0;
  for (const x of sorted) {
    cum += x.p;
    if (cum >= q - 1e-9) return x.v;
  }
  return sorted.length ? sorted[sorted.length - 1].v : 0;
}

export const mean = (d: Dist) => d.reduce((a, x) => a + x.v * x.p, 0);
