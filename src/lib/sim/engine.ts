/**
 * A fluid (rate-based) simulation of a distributed system.
 *
 * Each tick, traffic flows from sources along edges in topological order. Every node
 * has a capacity (replicas × per-replica rps). Excess work waits in a backlog; beyond
 * ~1s of backlog, requests time out and are dropped. Latency rises with utilization
 * (a queueing "hockey stick"), and end-to-end latency / failure is folded back up
 * the graph from the leaves to the clients.
 */
import type { ComponentType } from "../catalog";
import { ROLE, type NodeConfig } from "./config";

export interface SimNode {
  id: string;
  kind: ComponentType;
  label: string;
  config: NodeConfig;
}
export interface SimEdge {
  id: string;
  source: string;
  target: string;
  /**
   * Fan-out sources: calls to the target per request (undefined = 1, or the cache miss rate for a DB beside a cache).
   * Routers: relative traffic share (undefined = 1).
   */
  ratio?: number;
}

export type NodeStatus = "idle" | "ok" | "hot" | "overloaded" | "down";

export interface NodeMetrics {
  inRps: number;
  demandRps: number;
  outRps: number;
  capacity: number;
  utilization: number;
  ownMs: number;
  e2eMs: number;
  backlog: number;
  dropRps: number;
  throttleRps: number;
  status: NodeStatus;
}
export interface EdgeMetrics {
  rps: number;
  status: NodeStatus;
}
export interface HistoryPoint {
  t: number;
  offered: number;
  throughput: number;
  latencyMs: number;
  errorPct: number;
  queueDepth: number;
}
export interface Snapshot {
  t: number;
  offeredRps: number;
  throughputRps: number;
  latencyMs: number;
  errorPct: number;
  queueDepth: number;
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, EdgeMetrics>;
  history: HistoryPoint[];
  ignoredEdges: string[];
}

type LinkMode = "alt" | "call";
interface Link {
  edgeId: string;
  to: string;
  frac: number;
  mode: LinkMode;
}
export interface Compiled {
  nodes: Map<string, SimNode>;
  order: string[];
  out: Map<string, Link[]>;
  /** Consumers fed only by queues: they pull work, so the wait happens in the queue. */
  pullFed: Set<string>;
  ignoredEdges: string[];
}

const TIMEOUT_MS = 1000;
const BACKLOG_SECONDS = 1;
const MAX_QUEUE_DEPTH = 5_000_000;
const HISTORY_POINTS = 180;

const cap = (n: SimNode) => (n.config.down ? 0 : n.config.replicas * n.config.capacity);

const isStore = (n: SimNode) => n.kind === "cache" || ROLE[n.kind] === "store";

/**
 * How a node's processed traffic divides across its outgoing links.
 * - "alt": each request takes one of these paths (routing, cache misses, queue consumers).
 * - "call": each request calls this dependency `frac` times (fan-out, side-calls).
 */
function linkFractions(node: SimNode, targets: { edge: SimEdge; to: SimNode }[]): { frac: number; mode: LinkMode }[] {
  const role = ROLE[node.kind];
  if (targets.length === 0) return [];

  if (role === "route" || role === "limiter") {
    // Stores and caches beside a router are consulted per request (e.g. rate-limit counters);
    // everything else is a route target, weighted by the edge ratio, skipping dead nodes.
    const routes = targets.filter((t) => !isStore(t.to));
    const healthy = routes.filter((t) => !t.to.config.down);
    const pool = healthy.length ? healthy : routes;
    const total = pool.reduce((a, t) => a + (t.edge.ratio ?? 1), 0);
    return targets.map((t) =>
      isStore(t.to)
        ? { frac: t.edge.ratio ?? 1, mode: "call" }
        : { frac: pool.includes(t) && total > 0 ? (t.edge.ratio ?? 1) / total : 0, mode: "alt" },
    );
  }
  if (role === "cache") {
    const miss = 1 - node.config.hitRate;
    return targets.map(() => ({ frac: miss / targets.length, mode: "alt" }));
  }
  if (role === "queue") {
    const consumers = targets.map((t) => cap(t.to));
    const total = consumers.reduce((a, b) => a + b, 0);
    return targets.map((_, i) => ({ frac: total > 0 ? consumers[i] / total : 1 / targets.length, mode: "alt" }));
  }
  // Fan-out (source / compute / store): call every dependency. Cache-aside: unless the
  // edge sets an explicit ratio, a database beside a cache only sees the misses.
  const caches = targets.filter((t) => t.to.kind === "cache");
  const hit = caches.length ? caches.reduce((a, t) => a + t.to.config.hitRate, 0) / caches.length : 0;
  return targets.map((t) => {
    const isDb = t.to.kind === "sql_db" || t.to.kind === "nosql_db";
    return { frac: t.edge.ratio ?? (isDb && caches.length ? 1 - hit : 1), mode: "call" };
  });
}

/** The cache-aside ratio the engine would use for this edge when none is set — shown in the inspector. */
export function autoRatio(source: SimNode, target: SimNode, siblings: SimNode[]) {
  if (ROLE[source.kind] === "route" || ROLE[source.kind] === "limiter") return 1;
  const caches = siblings.filter((n) => n.kind === "cache");
  const isDb = target.kind === "sql_db" || target.kind === "nosql_db";
  if (!isDb || !caches.length) return 1;
  return 1 - caches.reduce((a, n) => a + n.config.hitRate, 0) / caches.length;
}

export function compile(nodes: SimNode[], edges: SimEdge[]): Compiled {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, SimEdge[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (e.source !== e.target && byId.has(e.source) && byId.has(e.target)) adj.get(e.source)!.push(e);
  }

  // DFS from sources first; edges that point back into the current path form cycles.
  const ignored = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of adj.get(id)!) {
      const s = state.get(e.target) ?? 0;
      if (s === 1) ignored.add(e.id);
      else if (s === 0) visit(e.target);
    }
    state.set(id, 2);
  };
  const sourcesFirst = [...nodes].sort((a, b) => Number(ROLE[b.kind] === "source") - Number(ROLE[a.kind] === "source"));
  for (const n of sourcesFirst) if (!state.get(n.id)) visit(n.id);

  // Kahn's algorithm on the remaining DAG.
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const list of adj.values()) for (const e of list) if (!ignored.has(e.id)) indeg.set(e.target, indeg.get(e.target)! + 1);
  const ready = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const e of adj.get(id)!) {
      if (ignored.has(e.id)) continue;
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) ready.push(e.target);
    }
  }

  const out = new Map<string, Link[]>();
  for (const n of nodes) {
    const targets = adj
      .get(n.id)!
      .filter((e) => !ignored.has(e.id))
      .map((e) => ({ edge: e, to: byId.get(e.target)! }));
    const fracs = linkFractions(n, targets);
    out.set(
      n.id,
      targets.map((t, i) => ({ edgeId: t.edge.id, to: t.to.id, ...fracs[i] })),
    );
  }
  const incoming = new Map<string, string[]>();
  for (const [from, links] of out) for (const l of links) incoming.set(l.to, [...(incoming.get(l.to) ?? []), from]);
  const pullFed = new Set(
    [...incoming]
      .filter(([, froms]) => froms.every((f) => ROLE[byId.get(f)!.kind] === "queue"))
      .map(([id]) => id),
  );
  return { nodes: byId, order, out, pullFed, ignoredEdges: [...ignored] };
}

export interface SimState {
  t: number;
  backlog: Record<string, number>;
  history: HistoryPoint[];
  bucket: { n: number; offered: number; throughput: number; latency: number; error: number; queue: number };
}

export function initialState(): SimState {
  return { t: 0, backlog: {}, history: [], bucket: { n: 0, offered: 0, throughput: 0, latency: 0, error: 0, queue: 0 } };
}

export function tick(g: Compiled, state: SimState, dt: number, offeredRps: number): Snapshot {
  const arrivals: Record<string, number> = {};
  /** Work that wants to reach a node — for queue consumers this is the queue's inflow, not what they drain. */
  const demand: Record<string, number> = {};
  const metrics: Record<string, NodeMetrics> = {};
  const edges: Record<string, EdgeMetrics> = {};
  const fail: Record<string, number> = {};

  const clients = g.order.filter((id) => g.nodes.get(id)!.kind === "client");
  for (const id of g.order) {
    arrivals[id] = 0;
    demand[id] = 0;
  }
  for (const id of clients) arrivals[id] = offeredRps / clients.length;
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    if (n.kind === "scheduler") arrivals[id] = n.config.sourceRps;
  }

  // Forward pass: move traffic through the graph.
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    const c = n.config;
    const role = ROLE[n.kind];
    const links = g.out.get(id)!;
    const inRps = arrivals[id];
    let processedRps = inRps;
    let dropRps = 0;
    let throttleRps = 0;
    let utilization = 0;
    let ownMs = 0;
    let backlog = state.backlog[id] ?? 0;
    const capacity = role === "source" ? 0 : cap(n);

    if (role === "queue") {
      const drain = c.down ? 0 : links.reduce((a, l) => a + cap(g.nodes.get(l.to)!), 0);
      const accepted = Math.min(inRps, capacity);
      dropRps += inRps - accepted;
      const avail = backlog + accepted * dt;
      const processed = Math.min(avail, drain * dt);
      backlog = avail - processed;
      if (backlog > MAX_QUEUE_DEPTH) {
        dropRps += (backlog - MAX_QUEUE_DEPTH) / dt;
        backlog = MAX_QUEUE_DEPTH;
      }
      processedRps = processed / dt;
      for (const l of links) demand[l.to] += accepted * l.frac;
      utilization = drain > 0 ? accepted / drain : accepted > 0 ? Infinity : 0;
      ownMs = c.latencyMs + c.extraLatencyMs;
    } else if (role !== "source") {
      let offered = inRps;
      if (role === "limiter") {
        offered = Math.min(inRps, c.rateLimit);
        throttleRps = inRps - offered;
      }
      const avail = backlog + offered * dt;
      const processed = Math.min(avail, capacity * dt);
      backlog = avail - processed;
      const maxBacklog = capacity * BACKLOG_SECONDS;
      if (backlog > maxBacklog) {
        dropRps += (backlog - maxBacklog) / dt;
        backlog = maxBacklog;
      }
      processedRps = processed / dt;
      if (g.pullFed.has(id)) {
        utilization = capacity > 0 ? demand[id] / capacity : demand[id] > 0 ? Infinity : 0;
        ownMs = c.latencyMs + c.extraLatencyMs;
      } else {
        utilization = capacity > 0 ? offered / capacity : offered > 0 ? Infinity : 0;
        const rho = Math.min(utilization, 0.95);
        const wait = capacity > 0 ? (backlog / capacity) * 1000 : 0;
        ownMs = (c.latencyMs + c.extraLatencyMs) * (1 + (0.5 * rho ** 4) / (1 - rho)) + wait;
      }
    }
    state.backlog[id] = backlog;

    for (const l of links) {
      const flow = processedRps * l.frac;
      arrivals[l.to] += flow;
      edges[l.edgeId] = { rps: flow, status: "ok" };
    }

    let status: NodeStatus = "ok";
    if (c.down && role !== "source") status = "down";
    else if (role !== "source" && inRps < 0.01) status = "idle";
    else if (dropRps > 0.01 || utilization >= 1) status = "overloaded";
    else if (utilization >= 0.75) status = "hot";

    fail[id] = c.down && role !== "source" ? 1 : inRps > 0 ? Math.min(1, (dropRps + throttleRps) / inRps) : 0;
    metrics[id] = {
      inRps,
      demandRps: g.pullFed.has(id) ? demand[id] : inRps,
      outRps: processedRps,
      capacity,
      utilization,
      ownMs,
      e2eMs: 0,
      backlog,
      dropRps,
      throttleRps,
      status,
    };
  }

  // Backward pass: fold latency and failure probability from leaves up to clients.
  const L: Record<string, number> = {};
  const F: Record<string, number> = {};
  for (const id of [...g.order].reverse()) {
    const n = g.nodes.get(id)!;
    const role = ROLE[n.kind];
    const m = metrics[id];
    const links = g.out.get(id)!;
    if (m.status === "down") {
      L[id] = TIMEOUT_MS;
      F[id] = 1;
    } else if (role === "queue") {
      // Async: the producer only waits for the enqueue.
      L[id] = m.ownMs;
      F[id] = fail[id];
    } else {
      // Alternative paths average their failure; sequential calls compound it.
      const alt = links.filter((l) => l.mode === "alt");
      const calls = links.filter((l) => l.mode === "call");
      L[id] = m.ownMs + links.reduce((a, l) => a + l.frac * L[l.to], 0);
      F[id] =
        1 -
        (1 - fail[id]) *
          (1 - alt.reduce((a, l) => a + l.frac * F[l.to], 0)) *
          calls.reduce((a, l) => a * (1 - Math.min(1, l.frac) * F[l.to]), 1);
    }
    m.e2eMs = L[id];
  }

  for (const links of g.out.values()) {
    for (const l of links) edges[l.edgeId].status = metrics[l.to].status;
  }

  const totalClient = clients.reduce((a, id) => a + arrivals[id], 0);
  const latencyMs = totalClient > 0 ? clients.reduce((a, id) => a + arrivals[id] * L[id], 0) / totalClient : 0;
  const errorFrac = totalClient > 0 ? clients.reduce((a, id) => a + arrivals[id] * F[id], 0) / totalClient : 0;
  const throughputRps = totalClient * (1 - errorFrac);
  const queueDepth = g.order
    .filter((id) => ROLE[g.nodes.get(id)!.kind] === "queue")
    .reduce((a, id) => a + (state.backlog[id] ?? 0), 0);

  // Aggregate into one history point per simulated second.
  state.t += dt;
  const b = state.bucket;
  b.n++;
  b.offered += totalClient;
  b.throughput += throughputRps;
  b.latency += latencyMs;
  b.error += errorFrac * 100;
  b.queue = queueDepth;
  if (Math.floor(state.t + 1e-9) > Math.floor(state.t - dt + 1e-9)) {
    state.history.push({
      t: Math.round(state.t),
      offered: b.offered / b.n,
      throughput: b.throughput / b.n,
      latencyMs: b.latency / b.n,
      errorPct: b.error / b.n,
      queueDepth: b.queue,
    });
    if (state.history.length > HISTORY_POINTS) state.history.shift();
    state.bucket = { n: 0, offered: 0, throughput: 0, latency: 0, error: 0, queue: 0 };
  }

  return {
    t: state.t,
    offeredRps: totalClient,
    throughputRps,
    latencyMs,
    errorPct: errorFrac * 100,
    queueDepth,
    nodes: metrics,
    edges,
    history: state.history,
    ignoredEdges: g.ignoredEdges,
  };
}
