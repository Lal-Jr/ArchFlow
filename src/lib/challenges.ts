/**
 * Challenges: fixed traffic, a time limit and goals (errors, tail latency, cost).
 * Component "physics" (capacity, latency, hit rates) is locked, so the only levers
 * are architectural ones — replicas, caches, queues, autoscaling, retries, breakers.
 */
import { gridGraph, toSim, type ArchNodeType, type FlowEdgeType } from "./graph";
import type { Difficulty } from "./problems";
import { monthlyCost, type NodeConfig } from "./sim/config";
import { compile, initialState, tick, type HistoryPoint, type Snapshot } from "./sim/engine";
import { offeredRps, type Pattern } from "./sim/traffic";

export interface ChallengeGoals {
  maxErrorPct: number;
  maxP99Ms: number;
  maxMonthlyCost: number;
  /** Messages still queued when time runs out. */
  maxFinalQueue?: number;
}

export interface Challenge {
  id: string;
  title: string;
  tagline: string;
  difficulty: Difficulty;
  brief: string;
  traffic: { pattern: Pattern; rps: number };
  durationS: number;
  goals: ChallengeGoals;
  start: () => { nodes: ArchNodeType[]; edges: FlowEdgeType[] };
  /** Conditions the player can't change, e.g. a database that stays down. Applied on top of their design. */
  overrides?: Record<string, Partial<NodeConfig>>;
  hints: string[];
}

/** Config fields that are part of the scenario's physics and can't be edited in a challenge. */
export const LOCKED_FIELDS: (keyof NodeConfig)[] = ["capacity", "latencyMs", "hitRate", "rateLimit", "sourceRps", "down", "extraLatencyMs"];

/** p99 is judged after this warm-up, so the first ticks of a cold start don't count. */
export const WARMUP_S = 5;

const threeTier = (db: Partial<NodeConfig> = {}) =>
  gridGraph(
    [
      ["users", "client", "Users", 0, 1],
      ["lb", "load_balancer", "Load Balancer", 1, 1],
      ["api", "service", "API Servers", 2, 1],
      ["redis", "cache", "Redis", 3, 0],
      ["db", "sql_db", "Postgres", 3, 2, db],
    ],
    [
      ["users", "lb"],
      ["lb", "api"],
      ["api", "redis"],
      ["api", "db"],
    ],
  );

export const CHALLENGES: Challenge[] = [
  {
    id: "black-friday",
    title: "Black Friday",
    tagline: "Survive a 5× flash-sale spike",
    difficulty: "Easy",
    brief:
      "A flash sale sends traffic from 1,500 to 7,500 requests per second for eight seconds. Keep the store up without blowing the budget.",
    traffic: { pattern: "spike", rps: 1500 },
    durationS: 60,
    goals: { maxErrorPct: 1, maxP99Ms: 300, maxMonthlyCost: 2500 },
    start: () => threeTier(),
    hints: [
      "Run it once and watch which component turns red when the spike hits.",
      "Autoscaling takes about 10 seconds to add replicas — longer than the spike lasts.",
      "Provision enough API capacity for the peak ahead of time. You need about 7,500 rps of headroom.",
    ],
  },
  {
    id: "db-outage",
    title: "Database outage",
    tagline: "Degrade gracefully while Postgres is down",
    difficulty: "Medium",
    brief:
      "Postgres just died, and it won't be back before the end of this challenge. Cache hits can still be served, but every request waiting on the database is timing out. Keep the site fast for everyone the cache can serve.",
    traffic: { pattern: "steady", rps: 1000 },
    durationS: 30,
    goals: { maxErrorPct: 25, maxP99Ms: 150, maxMonthlyCost: 1500 },
    start: () => threeTier(),
    overrides: { db: { down: true } },
    hints: [
      "Errors are unavoidable for cache misses — the goal is to stop the misses from slowing everyone else.",
      "A request that waits on a dead database holds on for a full 1-second timeout. Can the API stop calling it?",
      "Turn on the API's circuit breaker so calls to the dead database fail fast.",
    ],
  },
  {
    id: "retry-storm",
    title: "Retry storm",
    tagline: "Stop retries from taking down the database",
    difficulty: "Medium",
    brief:
      "The API retries failed database calls three times. The database is slightly under-provisioned, and each failure adds more load. Every request is a database read. Calm the storm within budget.",
    traffic: { pattern: "steady", rps: 2000 },
    durationS: 40,
    goals: { maxErrorPct: 2, maxP99Ms: 250, maxMonthlyCost: 900 },
    start: () =>
      gridGraph(
        [
          ["users", "client", "Users", 0, 1],
          ["lb", "load_balancer", "Load Balancer", 1, 1],
          ["api", "service", "API Servers", 2, 1, { retries: 3 }],
          ["db", "sql_db", "Postgres", 3, 1, { capacity: 1500 }],
        ],
        [
          ["users", "lb"],
          ["lb", "api"],
          ["api", "db"],
        ],
      ),
    hints: [
      "Watch the connection into Postgres — the retry multiplier shows how much load retries add.",
      "Adding database replicas works, but it's expensive. What if most reads never reached the database?",
      "Add a cache and connect the API to it. With a cache beside it, the database only sees misses.",
    ],
  },
  {
    id: "order-backlog",
    title: "Order backlog",
    tagline: "Drain the order queue after a flash sale",
    difficulty: "Hard",
    brief:
      "Orders go through a queue to workers. A spike floods the queue, and the workers can't catch up before the next wave. Keep checkout fast and finish with the backlog under control.",
    traffic: { pattern: "spike", rps: 300 },
    durationS: 60,
    goals: { maxErrorPct: 0.5, maxP99Ms: 150, maxMonthlyCost: 1500, maxFinalQueue: 1000 },
    start: () =>
      gridGraph(
        [
          ["users", "client", "Shoppers", 0, 1],
          ["lb", "load_balancer", "Load Balancer", 1, 1],
          ["api", "service", "Checkout API", 2, 1],
          ["q", "queue", "Order Queue", 3, 1],
          ["w", "worker", "Order Workers", 4, 1],
          ["db", "nosql_db", "Orders DB", 5, 1],
        ],
        [
          ["users", "lb"],
          ["lb", "api"],
          ["api", "q"],
          ["q", "w"],
          ["w", "db"],
        ],
      ),
    hints: [
      "The queue protects checkout, so latency is fine. The problem is how fast the workers drain it.",
      "Two workers drain 400 orders a second. A spike adds 1,500 a second for eight seconds.",
      "Add worker replicas. Autoscaling works too, but cap its maximum or the peak cost blows the budget.",
    ],
  },
];

export function getChallenge(id: string) {
  return CHALLENGES.find((c) => c.id === id);
}

/** Applies a challenge's fixed conditions on top of the player's design (for the engine only). */
export function applyOverrides<T extends { nodes: { id: string; config: NodeConfig }[] }>(sim: T, overrides?: Challenge["overrides"]): T {
  if (!overrides) return sim;
  return { ...sim, nodes: sim.nodes.map((n) => (overrides[n.id] ? { ...n, config: { ...n.config, ...overrides[n.id] } } : n)) };
}

export interface GoalResult {
  key: keyof ChallengeGoals;
  label: string;
  value: number;
  limit: number;
  passed: boolean;
}
export interface ChallengeResult {
  goals: GoalResult[];
  passed: boolean;
}

/** Scores a run from its per-second history and the peak cost seen while it ran. */
export function evaluate(challenge: Challenge, history: HistoryPoint[], peakCost: number): ChallengeResult {
  const offered = history.reduce((a, h) => a + h.offered, 0);
  const served = history.reduce((a, h) => a + h.throughput, 0);
  const errorPct = offered > 0 ? (1 - served / offered) * 100 : 100;
  const p99 = Math.max(0, ...history.filter((h) => h.t > WARMUP_S).map((h) => h.p99Ms));
  const finalQueue = history.at(-1)?.queueDepth ?? 0;
  const g = challenge.goals;
  const goals: GoalResult[] = [
    { key: "maxErrorPct", label: "Error rate", value: errorPct, limit: g.maxErrorPct, passed: errorPct <= g.maxErrorPct },
    { key: "maxP99Ms", label: "Worst p99 latency", value: p99, limit: g.maxP99Ms, passed: p99 <= g.maxP99Ms },
    { key: "maxMonthlyCost", label: "Peak monthly cost", value: peakCost, limit: g.maxMonthlyCost, passed: peakCost <= g.maxMonthlyCost },
  ];
  if (g.maxFinalQueue != null) {
    goals.push({ key: "maxFinalQueue", label: "Queue at the end", value: finalQueue, limit: g.maxFinalQueue, passed: finalQueue <= g.maxFinalQueue });
  }
  return { goals, passed: offered > 0 && goals.every((x) => x.passed) };
}

/** Live cost from a snapshot's replica counts. */
export function snapshotCost(sim: ReturnType<typeof toSim>, snap: Snapshot | null) {
  const live = snap ? Object.fromEntries(Object.entries(snap.nodes).map(([id, m]) => [id, m.replicas])) : undefined;
  return monthlyCost(sim.nodes, live);
}

/** Runs a challenge headlessly against a design — used by tests to prove each one is solvable. */
export function runChallenge(challenge: Challenge, graph: { nodes: ArchNodeType[]; edges: FlowEdgeType[] }): ChallengeResult {
  const sim = applyOverrides(toSim(graph.nodes, graph.edges), challenge.overrides);
  const g = compile(sim.nodes, sim.edges);
  const st = initialState();
  let peak = 0;
  let snap: Snapshot | null = null;
  const ticks = Math.round(challenge.durationS / 0.1);
  for (let i = 0; i < ticks; i++) {
    snap = tick(g, st, 0.1, offeredRps(challenge.traffic.pattern, challenge.traffic.rps, st.t));
    peak = Math.max(peak, snapshotCost(sim, snap));
  }
  return evaluate(challenge, st.history, peak);
}
