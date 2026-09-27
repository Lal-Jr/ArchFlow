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

const base = { hitRate: 0, rateLimit: 0, sourceRps: 0, down: false, extraLatencyMs: 0 };

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
