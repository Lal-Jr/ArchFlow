import { describe, expect, it } from "vitest";
import { CHALLENGES, getChallenge, runChallenge, type Challenge } from "./challenges";
import { gridGraph, type ArchNodeType } from "./graph";
import type { NodeConfig } from "./sim/config";

/** The challenge's starting design with some node configs changed. */
function tweak(challenge: Challenge, changes: Record<string, Partial<NodeConfig>>) {
  const g = challenge.start();
  g.nodes = g.nodes.map((n: ArchNodeType) =>
    changes[n.id] ? { ...n, data: { ...n.data, config: { ...n.data.config, ...changes[n.id] } } } : n,
  );
  return g;
}

const failed = (r: ReturnType<typeof runChallenge>) => r.goals.filter((x) => !x.passed).map((x) => x.key);

describe.each(CHALLENGES.map((c) => [c.id, c] as const))("%s", (_, challenge) => {
  it("fails with the starting design", () => {
    expect(runChallenge(challenge, challenge.start()).passed).toBe(false);
  });
});

describe("black friday", () => {
  const c = getChallenge("black-friday")!;
  it("passes with enough API replicas provisioned for the peak", () => {
    const r = runChallenge(c, tweak(c, { api: { replicas: 12 } }));
    expect(failed(r)).toEqual([]);
  });
  it("can't be solved by autoscaling alone — the spike is shorter than the provisioning delay", () => {
    const r = runChallenge(c, tweak(c, { api: { autoscale: true, maxReplicas: 20 } }));
    expect(failed(r)).toContain("maxErrorPct");
  });
});

describe("database outage", () => {
  const c = getChallenge("db-outage")!;
  it("passes once a circuit breaker fails the dead calls fast", () => {
    expect(failed(runChallenge(c, tweak(c, { api: { circuitBreaker: true } })))).toEqual([]);
  });
  it("keeps the database down even if the player revives it", () => {
    expect(runChallenge(c, tweak(c, { db: { down: false } })).passed).toBe(false);
  });
});

describe("retry storm", () => {
  const c = getChallenge("retry-storm")!;
  it("passes with a cache in front of the database", () => {
    const g = gridGraph(
      [
        ["users", "client", "Users", 0, 1],
        ["lb", "load_balancer", "Load Balancer", 1, 1],
        ["api", "service", "API Servers", 2, 1, { retries: 3 }],
        ["redis", "cache", "Redis", 3, 0],
        ["db", "sql_db", "Postgres", 3, 2, { capacity: 1500 }],
      ],
      [
        ["users", "lb"],
        ["lb", "api"],
        ["api", "redis"],
        ["api", "db"],
      ],
    );
    expect(failed(runChallenge(c, g))).toEqual([]);
  });
  it("blows the budget if you just add database replicas", () => {
    expect(failed(runChallenge(c, tweak(c, { db: { replicas: 2 } })))).toContain("maxMonthlyCost");
  });
});

describe("order backlog", () => {
  const c = getChallenge("order-backlog")!;
  it("passes with more workers draining the queue", () => {
    expect(failed(runChallenge(c, tweak(c, { w: { replicas: 4 } })))).toEqual([]);
  });
  it("blows the budget with uncapped autoscaling", () => {
    expect(failed(runChallenge(c, tweak(c, { w: { autoscale: true, maxReplicas: 20 } })))).toContain("maxMonthlyCost");
  });
});
