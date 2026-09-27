import type { ComponentType } from "../catalog";

/** Tunable knobs for one component. Capacity is per replica, in requests/sec. */
export interface NodeConfig {
  replicas: number;
  capacity: number;
  latencyMs: number;
  /** Cache / CDN only: fraction of requests served without going downstream. */
  hitRate: number;
  /** Rate limiter only: requests/sec allowed through; the rest get 429. */
  rateLimit: number;
  /** Scheduler only: jobs/sec it emits. */
  sourceRps: number;
  /** Chaos: node is dead — every request to it fails. */
  down: boolean;
  /** Chaos: added latency, e.g. a slow disk or GC pauses. */
  extraLatencyMs: number;
  /** Resilience: times this node retries a failed call to a dependency. */
  retries: number;
  /** Resilience: stop calling a dependency that is failing, so it can recover. */
  circuitBreaker: boolean;
  /** Elasticity: add replicas under load (starting from `replicas`, up to `maxReplicas`). */
  autoscale: boolean;
  maxReplicas: number;
}

export type NodeRole = "source" | "route" | "compute" | "cache" | "queue" | "store" | "limiter";

export const ROLE: Record<ComponentType, NodeRole> = {
  client: "source",
  scheduler: "source",
  dns: "route",
  load_balancer: "route",
  api_gateway: "route",
  rate_limiter: "limiter",
  cdn: "cache",
  cache: "cache",
  service: "compute",
  websocket: "compute",
  worker: "compute",
  queue: "queue",
  stream: "queue",
  sql_db: "store",
  nosql_db: "store",
  object_storage: "store",
  search: "store",
};

const base = {
  hitRate: 0,
  rateLimit: 0,
  sourceRps: 0,
  down: false,
  extraLatencyMs: 0,
  retries: 0,
  circuitBreaker: false,
  autoscale: false,
  maxReplicas: 20,
};

export const DEFAULTS: Record<ComponentType, NodeConfig> = {
  client: { ...base, replicas: 1, capacity: 0, latencyMs: 0 },
  scheduler: { ...base, replicas: 1, capacity: 0, latencyMs: 0, sourceRps: 5 },
  dns: { ...base, replicas: 1, capacity: 100_000, latencyMs: 1 },
  load_balancer: { ...base, replicas: 1, capacity: 50_000, latencyMs: 1 },
  api_gateway: { ...base, replicas: 2, capacity: 10_000, latencyMs: 3 },
  rate_limiter: { ...base, replicas: 2, capacity: 20_000, latencyMs: 1, rateLimit: 2_000 },
  cdn: { ...base, replicas: 1, capacity: 1_000_000, latencyMs: 15, hitRate: 0.9 },
  cache: { ...base, replicas: 1, capacity: 50_000, latencyMs: 1, hitRate: 0.8 },
  service: { ...base, replicas: 3, capacity: 800, latencyMs: 20 },
  websocket: { ...base, replicas: 3, capacity: 2_000, latencyMs: 5 },
  worker: { ...base, replicas: 2, capacity: 200, latencyMs: 80 },
  queue: { ...base, replicas: 1, capacity: 50_000, latencyMs: 2 },
  stream: { ...base, replicas: 1, capacity: 100_000, latencyMs: 3 },
  sql_db: { ...base, replicas: 1, capacity: 2_500, latencyMs: 8 },
  nosql_db: { ...base, replicas: 3, capacity: 5_000, latencyMs: 5 },
  object_storage: { ...base, replicas: 1, capacity: 20_000, latencyMs: 40 },
  search: { ...base, replicas: 2, capacity: 1_500, latencyMs: 25 },
};

/** Rough monthly cost of one replica, in USD — enough to reason about tradeoffs, not a price list. */
export const COST_PER_REPLICA: Record<ComponentType, number> = {
  client: 0,
  scheduler: 5,
  dns: 20,
  cdn: 150,
  load_balancer: 25,
  api_gateway: 60,
  rate_limiter: 40,
  cache: 110,
  service: 70,
  websocket: 90,
  worker: 60,
  queue: 40,
  stream: 300,
  sql_db: 350,
  nosql_db: 250,
  object_storage: 50,
  search: 280,
};

/** Roles that call other components, so retries and circuit breakers apply to them. */
export const CALLER_ROLES: NodeRole[] = ["source", "route", "limiter", "compute"];
/** Roles that can autoscale — stateless tiers, where adding replicas is cheap. */
export const SCALABLE_ROLES: NodeRole[] = ["route", "limiter", "compute"];

export function resolveConfig(kind: ComponentType, partial?: Partial<NodeConfig>): NodeConfig {
  return { ...DEFAULTS[kind], ...partial };
}

/** Plain-English description of how each role treats traffic — shown in the inspector. */
export const ROLE_BEHAVIOR: Record<NodeRole, string> = {
  source: "Generates traffic. Every outgoing edge receives each request.",
  route: "Splits traffic evenly across healthy downstream nodes (health checks skip dead ones).",
  limiter: "Passes up to its limit and rejects the rest with 429, then splits across downstream nodes.",
  compute: "Calls every downstream dependency per request. With a cache attached, databases only see cache misses. Queues are called asynchronously.",
  cache: "Serves hits itself. Misses continue to downstream nodes.",
  queue: "Buffers messages. Consumers pull as fast as their capacity allows, so the backlog grows when producers outpace them.",
  store: "Terminal data store. Requests end here.",
};

/** Estimated monthly cost of a design, using live (autoscaled) replica counts when given. */
export function monthlyCost(
  nodes: { id: string; kind: ComponentType; config: NodeConfig }[],
  liveReplicas?: Record<string, number>,
) {
  return nodes.reduce((sum, n) => sum + COST_PER_REPLICA[n.kind] * (liveReplicas?.[n.id] ?? n.config.replicas), 0);
}
