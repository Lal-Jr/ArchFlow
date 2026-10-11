/**
 * A fluid (rate-based) simulation of a distributed system.
 *
 * Each tick, traffic flows from sources along edges in topological order. Every node
 * has a capacity (replicas × per-replica rps). Excess work waits in a backlog; beyond
 * ~1s of backlog, requests time out and are dropped. Latency rises with utilization
 * (a queueing "hockey stick"), and end-to-end latency / failure is folded back up
 * the graph from the leaves to the clients.
 *
 * On top of that: callers can retry failed calls (amplifying load on a struggling
 * dependency) or trip a circuit breaker (failing fast so it can recover), stateless
 * tiers can autoscale, and latency is tracked as a distribution for p95 / p99.
 *
 * Traffic is split into classes, one per endpoint in the clients' request mixes. Every
 * class shares the same capacity, but routes separately: reads can be served by caches
 * while writes go through to the store, and routers only send an endpoint to services
 * that handle it.
 */
import type { ComponentType } from "../catalog";
import { CALLER_ROLES, ROLE, SCALABLE_ROLES, type NodeConfig } from "./config";
import { ANY, isWrite, requestMix, type Endpoint } from "./endpoints";
import { convolve, mean as distMean, mix, ownLatency, point, quantile, scale, type Dist } from "./latency";

export interface SimNode {
  id: string;
  kind: ComponentType;
  label: string;
  config: NodeConfig;
  /** Clients only: the request mix they send. None means one unlabelled stream of reads. */
  endpoints?: Endpoint[];
  /** Services only: the endpoint keys ("GET /feed") this node handles. None means all of them. */
  serves?: string[];
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
  /** Live replica count (differs from the config when autoscaling). */
  replicas: number;
  /** Replica count being provisioned, if a scale-out is in flight (0 otherwise). */
  pendingReplicas: number;
  utilization: number;
  ownMs: number;
  e2eMs: number;
  backlog: number;
  dropRps: number;
  throttleRps: number;
  /** Requests for endpoints this node can't serve or route anywhere (404s). */
  rejectRps: number;
  /** Arriving requests per traffic class, indexed like `Compiled.classes`. */
  inByClass: number[];
  status: NodeStatus;
}
export interface EdgeMetrics {
  rps: number;
  status: NodeStatus;
  /** Circuit breaker on this call is open: the caller fails fast instead of calling. */
  breakerOpen: boolean;
  /** Load multiplier from retries (1 = no retries happening). */
  retryFactor: number;
}
export interface EndpointMetrics {
  key: string;
  offeredRps: number;
  throughputRps: number;
  latencyMs: number;
  p99Ms: number;
  errorPct: number;
}
export interface HistoryPoint {
  t: number;
  offered: number;
  throughput: number;
  latencyMs: number;
  p99Ms: number;
  errorPct: number;
  queueDepth: number;
}
export interface Snapshot {
  t: number;
  offeredRps: number;
  throughputRps: number;
  latencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorPct: number;
  queueDepth: number;
  nodes: Record<string, NodeMetrics>;
  edges: Record<string, EdgeMetrics>;
  /** Per endpoint, when any client declares a request mix (empty otherwise). */
  endpoints: EndpointMetrics[];
  history: HistoryPoint[];
  ignoredEdges: string[];
}

type LinkMode = "alt" | "call";
interface Link {
  edgeId: string;
  to: string;
  mode: LinkMode;
  /** Share or calls per request, per traffic class (indexed like `Compiled.classes`). */
  fracs: number[];
}
export interface Compiled {
  nodes: Map<string, SimNode>;
  order: string[];
  out: Map<string, Link[]>;
  /** Consumers fed only by queues: they pull work, so the wait happens in the queue. */
  pullFed: Set<string>;
  ignoredEdges: string[];
  /** Traffic classes: endpoint keys, plus ANY for clients without a request mix. */
  classes: string[];
  /** Per node and class: requests this node turns away (a service not bound to it, or a router with nowhere to send it). */
  rejects: Map<string, boolean[]>;
  /** Per source: the fraction of its traffic in each class. */
  sourceMix: Map<string, number[]>;
}

const TIMEOUT_MS = 1000;
const BACKLOG_SECONDS = 1;
const MAX_QUEUE_DEPTH = 5_000_000;
const HISTORY_POINTS = 180;
const BREAKER_THRESHOLD = 0.5;
export const BREAKER_COOLDOWN_S = 5;
export const AUTOSCALE_TARGET = 0.6;
export const PROVISION_DELAY_S = 10;
const SCALE_IN_COOLDOWN_S = 30;

const isStore = (n: SimNode) => n.kind === "cache" || ROLE[n.kind] === "store";
const isQueue = (n: SimNode) => ROLE[n.kind] === "queue";
const isRouter = (n: SimNode) => ROLE[n.kind] === "route" || ROLE[n.kind] === "limiter";

type Target = { edge: SimEdge; to: SimNode };

/**
 * A router's targets split into the ones it routes between and the ones it consults on every
 * request (stores and caches beside it, e.g. rate-limit counters). A router with nothing but
 * stores behind it is sharding, so they are all routes.
 */
function routeTargets(targets: Target[]) {
  const sharding = targets.every((t) => isStore(t.to));
  return targets.filter((t) => sharding || !isStore(t.to));
}

/**
 * How a node's processed traffic of one class divides across its outgoing links.
 * - "alt": each request takes one of these paths (routing, cache misses, queue consumers).
 * - "call": each request calls this dependency `frac` times (fan-out, side-calls).
 */
function linkFractions(node: SimNode, targets: Target[], write: boolean, accepts: (id: string) => boolean): { frac: number; mode: LinkMode }[] {
  const role = ROLE[node.kind];
  if (targets.length === 0) return [];

  if (isRouter(node)) {
    // Routes are weighted by the edge ratio, skipping dead nodes and ones that don't handle this endpoint.
    const routes = routeTargets(targets);
    const able = routes.filter((t) => accepts(t.to.id));
    const healthy = able.filter((t) => !t.to.config.down);
    const pool = healthy.length ? healthy : able;
    const total = pool.reduce((a, t) => a + (t.edge.ratio ?? 1), 0);
    return targets.map((t) =>
      !routes.includes(t)
        ? { frac: t.edge.ratio ?? 1, mode: "call" }
        : { frac: pool.includes(t) && total > 0 ? (t.edge.ratio ?? 1) / total : 0, mode: "alt" },
    );
  }
  if (role === "cache") {
    // Writes pass through a cache to whatever is behind it.
    const miss = write ? 1 : 1 - node.config.hitRate;
    return targets.map(() => ({ frac: miss / targets.length, mode: "alt" }));
  }
  if (role === "queue") {
    // Placeholder: queue shares are recomputed every tick from live consumer capacity.
    return targets.map(() => ({ frac: 1 / targets.length, mode: "alt" }));
  }
  // Fan-out (source / compute / store): call every dependency. Cache-aside: unless the
  // edge sets an explicit ratio, a database beside a cache only sees the read misses.
  const caches = targets.filter((t) => t.to.kind === "cache");
  const hit = caches.length ? caches.reduce((a, t) => a + t.to.config.hitRate, 0) / caches.length : 0;
  return targets.map((t) => {
    const isDb = t.to.kind === "sql_db" || t.to.kind === "nosql_db";
    return { frac: t.edge.ratio ?? (isDb && caches.length && !write ? 1 - hit : 1), mode: "call" };
  });
}

/** The cache-aside ratio the engine would use for this edge when none is set — shown in the inspector. */
export function autoRatio(source: SimNode, target: SimNode, siblings: SimNode[]) {
  if (isRouter(source)) return 1;
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

  const targetsOf = (id: string): Target[] =>
    adj
      .get(id)!
      .filter((e) => !ignored.has(e.id))
      .map((e) => ({ edge: e, to: byId.get(e.target)! }));

  // Traffic classes, in the order clients declare them.
  const mixes = new Map<string, [string, number][]>();
  for (const n of nodes) {
    if (ROLE[n.kind] === "source") mixes.set(n.id, n.kind === "client" ? requestMix(n.endpoints) : [[ANY, 1]]);
  }
  const classes = [...new Set([...mixes.values()].flatMap((m) => m.map(([k]) => k)))];
  if (!classes.length) classes.push(ANY);
  const sourceMix = new Map(
    [...mixes].map(([id, m]) => [id, classes.map((k) => m.find(([key]) => key === k)?.[1] ?? 0)] as const),
  );

  // Whether a node handles a class: a bound service only its endpoints, a router if anything it routes to does.
  const acceptMemo = new Map<string, boolean>();
  const accepts = (id: string, k: string): boolean => {
    const memo = acceptMemo.get(`${id} ${k}`);
    if (memo != null) return memo;
    const n = byId.get(id)!;
    let ok = true;
    if (k !== ANY && ROLE[n.kind] === "compute" && n.serves?.length) ok = n.serves.includes(k);
    else if (k !== ANY && isRouter(n)) {
      const routes = routeTargets(targetsOf(id));
      ok = routes.length === 0 || routes.some((t) => accepts(t.to.id, k));
    }
    acceptMemo.set(`${id} ${k}`, ok);
    return ok;
  };

  const out = new Map<string, Link[]>();
  const rejects = new Map<string, boolean[]>();
  for (const n of nodes) {
    const targets = targetsOf(n.id);
    const perClass = classes.map((k) => linkFractions(n, targets, isWrite(k), (id) => accepts(id, k)));
    out.set(
      n.id,
      targets.map((t, i) => ({
        edgeId: t.edge.id,
        to: t.to.id,
        mode: perClass[0][i].mode,
        fracs: perClass.map((fr) => fr[i].frac),
      })),
    );
    rejects.set(
      n.id,
      classes.map((k) => ROLE[n.kind] !== "source" && !accepts(n.id, k)),
    );
  }

  const incoming = new Map<string, string[]>();
  for (const [from, links] of out) for (const l of links) incoming.set(l.to, [...(incoming.get(l.to) ?? []), from]);
  const pullFed = new Set(
    [...incoming]
      .filter(([, froms]) => froms.every((f) => ROLE[byId.get(f)!.kind] === "queue"))
      .map(([id]) => id),
  );
  return { nodes: byId, order, out, pullFed, ignoredEdges: [...ignored], classes, rejects, sourceMix };
}

export interface SimState {
  t: number;
  backlog: Record<string, number>;
  history: HistoryPoint[];
  bucket: { n: number; offered: number; throughput: number; latency: number; p99: number; error: number; queue: number };
  /** Live replica counts, for autoscaled nodes. */
  replicas: Record<string, number>;
  pending: Record<string, { replicas: number; at: number }>;
  lastScaleUp: Record<string, number>;
  /** Last tick's failure probability and demand per node — inputs to retries, breakers and autoscaling. */
  prevFail: Record<string, number>;
  prevDemand: Record<string, number>;
  breakerUntil: Record<string, number>;
  /** Class mix of the work each node last accepted, so a backlog drains as the same mix. */
  mix: Record<string, number[]>;
}

export function initialState(): SimState {
  return {
    t: 0,
    backlog: {},
    history: [],
    bucket: { n: 0, offered: 0, throughput: 0, latency: 0, p99: 0, error: 0, queue: 0 },
    replicas: {},
    pending: {},
    lastScaleUp: {},
    prevFail: {},
    prevDemand: {},
    breakerUntil: {},
    mix: {},
  };
}

function liveReplicas(n: SimNode, state: SimState) {
  return n.config.autoscale ? (state.replicas[n.id] ?? n.config.replicas) : n.config.replicas;
}
function liveCap(n: SimNode, state: SimState) {
  return n.config.down ? 0 : liveReplicas(n, state) * n.config.capacity;
}

/** Target-tracking autoscaler: aim for 60% utilization, with a provisioning delay and a scale-in cooldown. */
function autoscale(g: Compiled, state: SimState) {
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    const c = n.config;
    if (!c.autoscale || c.down || !SCALABLE_ROLES.includes(ROLE[n.kind])) continue;
    const min = c.replicas;
    const max = Math.max(min, c.maxReplicas);
    const live = Math.min(max, Math.max(min, state.replicas[id] ?? min));
    state.replicas[id] = live;
    const pending = state.pending[id];
    if (pending && state.t >= pending.at) {
      state.replicas[id] = Math.min(max, pending.replicas);
      delete state.pending[id];
      continue;
    }
    const demand = state.prevDemand[id] ?? 0;
    const desired = Math.min(max, Math.max(min, Math.ceil(demand / (c.capacity * AUTOSCALE_TARGET))));
    if (desired > live && (!pending || desired > pending.replicas)) {
      state.pending[id] = { replicas: desired, at: pending?.at ?? state.t + PROVISION_DELAY_S };
      state.lastScaleUp[id] = state.t;
    } else if (desired < live && !pending && state.t - (state.lastScaleUp[id] ?? -Infinity) > SCALE_IN_COOLDOWN_S) {
      state.replicas[id] = desired;
    }
  }
}

export interface TickOptions {
  /** Compute p50/p95/p99 this tick. Skippable on intermediate ticks, since it's the costly part. */
  tail?: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
/** Weighted average of `values`, falling back to a plain average when every weight is zero. */
const weighted = (values: number[], weights: number[]) => {
  const w = sum(weights);
  return w > 0 ? values.reduce((a, v, i) => a + v * weights[i], 0) / w : sum(values) / Math.max(1, values.length);
};

export function tick(g: Compiled, state: SimState, dt: number, offeredRps: number, opts: TickOptions = {}): Snapshot {
  const tail = opts.tail ?? true;
  // Autoscaling decisions happen once per simulated second.
  if (Math.floor(state.t + dt + 1e-9) > Math.floor(state.t + 1e-9)) autoscale(g, state);

  const K = g.classes.length;
  const zeros = () => new Array<number>(K).fill(0);
  /** Requests per second arriving at each node, per class. */
  const arrivals: Record<string, number[]> = {};
  /** Work that wants to reach a node — for queue consumers this is the queue's inflow, not what they drain. */
  const demand: Record<string, number> = {};
  const metrics: Record<string, NodeMetrics> = {};
  const edges: Record<string, EdgeMetrics> = {};
  /** Share of the requests a node accepts that it fails itself (drops, 429s). */
  const fail: Record<string, number> = {};
  const runtime = new Map<string, { open: boolean; factor: number; retries: number; fracs: number[] }>();

  const clients = g.order.filter((id) => g.nodes.get(id)!.kind === "client");
  for (const id of g.order) {
    arrivals[id] = zeros();
    demand[id] = 0;
  }
  for (const id of clients) arrivals[id] = g.sourceMix.get(id)!.map((f) => (offeredRps / clients.length) * f);
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    if (n.kind === "scheduler") arrivals[id] = g.sourceMix.get(id)!.map((f) => n.config.sourceRps * f);
  }

  // Forward pass: move traffic through the graph.
  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    const c = n.config;
    const role = ROLE[n.kind];
    const links = g.out.get(id)!;
    const rejects = g.rejects.get(id)!;
    const inK = arrivals[id];
    const inRps = sum(inK);
    const rejectRps = sum(inK.filter((_, k) => rejects[k]));
    const accepted = inRps - rejectRps;
    // The class mix of what this node works on: what it accepted, or what it last accepted if a backlog is draining.
    let mixK = state.mix[id] ?? rejects.map((r) => (r ? 0 : 1 / Math.max(1, rejects.filter((x) => !x).length)));
    if (accepted > 1e-9) {
      mixK = inK.map((v, k) => (rejects[k] ? 0 : v / accepted));
      state.mix[id] = mixK;
    }

    let processedRps = accepted;
    let dropRps = 0;
    let throttleRps = 0;
    let utilization = 0;
    let ownMs = 0;
    let backlog = state.backlog[id] ?? 0;
    const capacity = role === "source" ? 0 : liveCap(n, state);
    let shares: number[] | null = null;

    if (role === "queue") {
      // Consumers pull in proportion to their live capacity.
      const caps = links.map((l) => liveCap(g.nodes.get(l.to)!, state));
      const drain = c.down ? 0 : sum(caps);
      shares = caps.map((cp) => (drain > 0 ? cp / drain : 1 / links.length));
      const enqueued = Math.min(accepted, capacity);
      dropRps += accepted - enqueued;
      const avail = backlog + enqueued * dt;
      const processed = Math.min(avail, drain * dt);
      backlog = avail - processed;
      if (backlog > MAX_QUEUE_DEPTH) {
        dropRps += (backlog - MAX_QUEUE_DEPTH) / dt;
        backlog = MAX_QUEUE_DEPTH;
      }
      processedRps = processed / dt;
      links.forEach((l, i) => (demand[l.to] += enqueued * shares![i]));
      utilization = drain > 0 ? enqueued / drain : enqueued > 0 ? Infinity : 0;
      ownMs = c.latencyMs + c.extraLatencyMs;
    } else if (role !== "source") {
      let offered = accepted;
      if (role === "limiter") {
        offered = Math.min(accepted, c.rateLimit);
        throttleRps = accepted - offered;
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
        demand[id] = offered;
        utilization = capacity > 0 ? offered / capacity : offered > 0 ? Infinity : 0;
        const rho = Math.min(utilization, 0.95);
        const wait = capacity > 0 ? (backlog / capacity) * 1000 : 0;
        ownMs = (c.latencyMs + c.extraLatencyMs) * (1 + (0.5 * rho ** 4) / (1 - rho)) + wait;
      }
    }
    state.backlog[id] = backlog;

    const caller = CALLER_ROLES.includes(role);
    links.forEach((l, i) => {
      const sync = caller && !isQueue(g.nodes.get(l.to)!);
      const prevF = state.prevFail[l.to] ?? 0;
      // Circuit breaker: trip on a failing dependency, stay open for a cooldown, then try again.
      let open = false;
      if (sync && c.circuitBreaker) {
        if ((state.breakerUntil[l.edgeId] ?? 0) > state.t) open = true;
        else if (prevF > BREAKER_THRESHOLD) {
          state.breakerUntil[l.edgeId] = state.t + BREAKER_COOLDOWN_S;
          open = true;
        }
      }
      // Retries: each failed attempt is retried, so load grows by 1 + F + F² + … + F^r.
      const retries = sync ? c.retries : 0;
      const factor = retries > 0 ? (prevF >= 0.999 ? retries + 1 : (1 - prevF ** (retries + 1)) / (1 - prevF)) : 1;
      const fracs = shares ? l.fracs.map(() => shares![i]) : l.fracs;
      let flow = 0;
      if (!open) {
        for (let k = 0; k < K; k++) {
          const f = processedRps * mixK[k] * fracs[k] * factor;
          arrivals[l.to][k] += f;
          flow += f;
        }
      }
      edges[l.edgeId] = { rps: flow, status: "ok", breakerOpen: open, retryFactor: factor };
      runtime.set(l.edgeId, { open, factor, retries, fracs });
    });

    let status: NodeStatus = "ok";
    if (c.down && role !== "source") status = "down";
    else if (role !== "source" && inRps < 0.01) status = "idle";
    else if (dropRps > 0.01 || utilization >= 1) status = "overloaded";
    else if (utilization >= 0.75) status = "hot";

    fail[id] = c.down && role !== "source" ? 1 : accepted > 0 ? Math.min(1, (dropRps + throttleRps) / accepted) : 0;
    metrics[id] = {
      inRps,
      demandRps: g.pullFed.has(id) ? demand[id] : accepted,
      outRps: processedRps,
      capacity,
      replicas: liveReplicas(n, state),
      pendingReplicas: state.pending[id]?.replicas ?? 0,
      utilization,
      ownMs,
      e2eMs: 0,
      backlog,
      dropRps,
      throttleRps,
      rejectRps,
      inByClass: [...inK],
      status,
    };
  }

  // Backward pass: fold latency, failure probability and the latency distribution from leaves up to clients, per class.
  const L: Record<string, number[]> = {};
  const F: Record<string, number[]> = {};
  const D: Record<string, Dist[]> = {};
  for (const id of [...g.order].reverse()) {
    const n = g.nodes.get(id)!;
    const role = ROLE[n.kind];
    const m = metrics[id];
    const links = g.out.get(id)!;
    const rejects = g.rejects.get(id)!;
    const base = n.config.latencyMs + n.config.extraLatencyMs;
    L[id] = zeros();
    F[id] = zeros();
    D[id] = [];
    for (let k = 0; k < K; k++) {
      if (m.status === "down") {
        L[id][k] = TIMEOUT_MS;
        F[id][k] = 1;
        if (tail) D[id][k] = point(TIMEOUT_MS);
      } else if (rejects[k]) {
        // Turned away straight away, without queueing for capacity.
        L[id][k] = base;
        F[id][k] = 1;
        if (tail) D[id][k] = point(base);
      } else if (role === "queue") {
        // Async: the producer only waits for the enqueue.
        L[id][k] = m.ownMs;
        F[id][k] = fail[id];
        if (tail) D[id][k] = point(m.ownMs);
      } else {
        // What one request experiences on each link, after retries or a tripped breaker.
        const eff = links.map((l) => {
          const rt = runtime.get(l.edgeId)!;
          const frac = rt.fracs[k];
          if (rt.open) return { mode: l.mode, frac, lat: 0, f: 1, dist: point(0) };
          return {
            mode: l.mode,
            frac,
            lat: L[l.to][k] * rt.factor,
            f: F[l.to][k] ** (rt.retries + 1),
            dist: tail ? scale(D[l.to][k], rt.factor) : [],
          };
        });
        const alt = eff.filter((e) => e.mode === "alt");
        const calls = eff.filter((e) => e.mode === "call");
        L[id][k] = m.ownMs + eff.reduce((a, e) => a + e.frac * e.lat, 0);
        // Alternative paths average their failure; sequential calls compound it.
        F[id][k] =
          1 -
          (1 - fail[id]) *
            (1 - alt.reduce((a, e) => a + e.frac * e.f, 0)) *
            calls.reduce((a, e) => a * (1 - Math.min(1, e.frac) * e.f), 1);
        if (tail) {
          let d = ownLatency(m.ownMs, base);
          if (alt.length) d = convolve(d, mix(alt.map((e) => ({ w: e.frac, d: e.dist }))));
          // A call made on every request stretches the path; an occasional one mixes in.
          for (const e of calls) d = convolve(d, e.frac >= 1 ? scale(e.dist, e.frac) : mix([{ w: e.frac, d: e.dist }]));
          D[id][k] = d;
        }
      }
    }
    m.e2eMs = weighted(L[id], arrivals[id]);
  }

  for (const links of g.out.values()) {
    for (const l of links) edges[l.edgeId].status = metrics[l.to].status;
  }

  // Client-side totals, overall and per endpoint.
  const perClass = g.classes.map((key, k) => {
    const offered = sum(clients.map((id) => arrivals[id][k]));
    const latency = weighted(
      clients.map((id) => L[id][k]),
      clients.map((id) => arrivals[id][k]),
    );
    const errorFrac = offered > 0 ? sum(clients.map((id) => arrivals[id][k] * F[id][k])) / offered : 0;
    const dist = tail && offered > 0 ? mix(clients.map((id) => ({ w: arrivals[id][k] / offered, d: D[id][k] }))) : null;
    return { key, offered, latency, errorFrac, dist };
  });
  const totalClient = sum(perClass.map((p) => p.offered));
  const latencyMs = totalClient > 0 ? sum(perClass.map((p) => p.offered * p.latency)) / totalClient : 0;
  const errorFrac = totalClient > 0 ? sum(perClass.map((p) => p.offered * p.errorFrac)) / totalClient : 0;
  const throughputRps = totalClient * (1 - errorFrac);
  const queueDepth = g.order.filter((id) => isQueue(g.nodes.get(id)!)).reduce((a, id) => a + (state.backlog[id] ?? 0), 0);

  let p50Ms = 0;
  let p95Ms = 0;
  let p99Ms = 0;
  if (tail && totalClient > 0) {
    const live = perClass.filter((p) => p.dist);
    const overall = live.length === 1 ? live[0].dist! : mix(live.map((p) => ({ w: p.offered / totalClient, d: p.dist! })));
    p50Ms = quantile(overall, 0.5);
    p95Ms = quantile(overall, 0.95);
    // Compression can shave the extreme tail; p99 is never below the mean.
    p99Ms = Math.max(quantile(overall, 0.99), distMean(overall));
  }
  // Endpoints are what clients call; a scheduler's jobs aren't one, and a lone unlabelled stream isn't either.
  const clientClasses = perClass.filter((_, k) => clients.some((id) => g.sourceMix.get(id)![k] > 0));
  const endpoints: EndpointMetrics[] =
    clientClasses.every((p) => p.key === ANY)
      ? []
      : clientClasses.map((p) => ({
          key: p.key,
          offeredRps: p.offered,
          throughputRps: p.offered * (1 - p.errorFrac),
          latencyMs: p.latency,
          p99Ms: p.dist ? Math.max(quantile(p.dist, 0.99), distMean(p.dist)) : 0,
          errorPct: p.errorFrac * 100,
        }));

  state.prevFail = Object.fromEntries(g.order.map((id) => [id, weighted(F[id], arrivals[id])]));
  state.prevDemand = demand;

  // Aggregate into one history point per simulated second.
  state.t += dt;
  const b = state.bucket;
  b.n++;
  b.offered += totalClient;
  b.throughput += throughputRps;
  b.latency += latencyMs;
  if (tail) b.p99 = p99Ms;
  b.error += errorFrac * 100;
  b.queue = queueDepth;
  if (Math.floor(state.t + 1e-9) > Math.floor(state.t - dt + 1e-9)) {
    state.history.push({
      t: Math.round(state.t),
      offered: b.offered / b.n,
      throughput: b.throughput / b.n,
      latencyMs: b.latency / b.n,
      p99Ms: b.p99,
      errorPct: b.error / b.n,
      queueDepth: b.queue,
    });
    if (state.history.length > HISTORY_POINTS) state.history.shift();
    state.bucket = { ...b, n: 0, offered: 0, throughput: 0, latency: 0, error: 0, queue: 0 };
  }

  return {
    t: state.t,
    offeredRps: totalClient,
    throughputRps,
    latencyMs,
    p50Ms,
    p95Ms,
    p99Ms,
    errorPct: errorFrac * 100,
    queueDepth,
    nodes: metrics,
    edges,
    endpoints,
    history: state.history,
    ignoredEdges: g.ignoredEdges,
  };
}
