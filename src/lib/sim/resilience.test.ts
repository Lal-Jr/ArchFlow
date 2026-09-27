import { describe, expect, it } from "vitest";
import { compile, initialState, tick, type Snapshot } from "./engine";
import { edge, node, simulate } from "./testing";

describe("retries", () => {
  // The database handles 500 rps; the API sends it 1,000.
  const overloadedDb = (retries: number) =>
    simulate(
      [node("c", "client"), node("api", "service", { retries }), node("db", "sql_db", { capacity: 500 })],
      [edge("c", "api"), edge("api", "db")],
      1000,
      20,
    );

  it("amplify load on a struggling dependency (a retry storm)", () => {
    const calm = overloadedDb(0);
    const storm = overloadedDb(3);
    expect(storm.nodes.db.inRps).toBeGreaterThan(calm.nodes.db.inRps * 1.5);
    expect(storm.edges["api->db"].retryFactor).toBeGreaterThan(1.5);
  });

  it("don't rescue a dependency that is out of capacity", () => {
    expect(overloadedDb(3).errorPct).toBeGreaterThanOrEqual(overloadedDb(0).errorPct - 1);
  });

  it("do nothing while the dependency is healthy", () => {
    const s = simulate([node("c", "client"), node("api", "service", { retries: 3 }), node("db", "sql_db")], [edge("c", "api"), edge("api", "db")], 500);
    expect(s.nodes.db.inRps).toBeCloseTo(500);
    expect(s.edges["api->db"].retryFactor).toBe(1);
  });
});

describe("circuit breaker", () => {
  const deadDb = (circuitBreaker: boolean) =>
    simulate(
      [node("c", "client"), node("api", "service", { circuitBreaker }), node("db", "sql_db", { down: true })],
      [edge("c", "api"), edge("api", "db")],
      500,
    );

  it("stops calling a dead dependency", () => {
    const s = deadDb(true);
    expect(s.edges["api->db"].breakerOpen).toBe(true);
    expect(s.nodes.db.inRps).toBe(0);
  });

  it("fails fast instead of waiting for timeouts", () => {
    expect(deadDb(true).latencyMs).toBeLessThan(deadDb(false).latencyMs / 5);
    expect(deadDb(true).errorPct).toBeCloseTo(100);
  });

  it("closes again once the dependency recovers", () => {
    const nodes = [node("c", "client"), node("api", "service", { circuitBreaker: true }), node("db", "sql_db", { down: true })];
    const edges = [edge("c", "api"), edge("api", "db")];
    const st = initialState();
    let s: Snapshot;
    let g = compile(nodes, edges);
    for (let i = 0; i < 20; i++) s = tick(g, st, 0.1, 500);
    nodes[2] = node("db", "sql_db"); // back up
    g = compile(nodes, edges);
    for (let i = 0; i < 80; i++) s = tick(g, st, 0.1, 500);
    expect(s!.edges["api->db"].breakerOpen).toBe(false);
    expect(s!.errorPct).toBe(0);
  });
});

describe("autoscaling", () => {
  const run = (seconds: number, rps = 3000) => {
    const g = compile(
      [node("c", "client"), node("api", "service", { replicas: 2, autoscale: true, maxReplicas: 10 })],
      [edge("c", "api")],
    );
    const st = initialState();
    let s!: Snapshot;
    for (let i = 0; i < seconds * 10; i++) s = tick(g, st, 0.1, rps);
    return { s, st, g };
  };

  it("provisions replicas after a delay", () => {
    const early = run(5).s;
    expect(early.nodes.api.replicas).toBe(2);
    expect(early.nodes.api.pendingReplicas).toBe(7); // ceil(3000 / (800 × 0.6))
    expect(early.nodes.api.status).toBe("overloaded");
  });

  it("clears the overload once the new replicas are live", () => {
    const later = run(30).s;
    expect(later.nodes.api.replicas).toBe(7);
    expect(later.errorPct).toBe(0);
  });

  it("never exceeds its maximum", () => {
    expect(run(30, 20_000).s.nodes.api.replicas).toBe(10);
  });

  it("scales back in after the cooldown when load drops", () => {
    const { st, g } = run(20);
    let s!: Snapshot;
    for (let i = 0; i < 600; i++) s = tick(g, st, 0.1, 300);
    expect(s.nodes.api.replicas).toBe(2); // back to the minimum
  });
});
