import { describe, expect, it } from "vitest";
import { compile } from "./engine";
import { edge, node, simulate } from "./testing";

const threeTier = (db: Parameters<typeof node>[2] = {}) => ({
  nodes: [node("c", "client"), node("lb", "load_balancer"), node("api", "service"), node("cache", "cache"), node("db", "nosql_db", db)],
  edges: [edge("c", "lb"), edge("lb", "api"), edge("api", "cache"), edge("api", "db")],
});

describe("traffic flow", () => {
  it("conserves traffic through a healthy chain", () => {
    const s = simulate([node("c", "client"), node("lb", "load_balancer"), node("api", "service")], [edge("c", "lb"), edge("lb", "api")], 1000);
    expect(s.nodes.api.inRps).toBeCloseTo(1000);
    expect(s.throughputRps).toBeCloseTo(1000);
    expect(s.errorPct).toBe(0);
  });

  it("sends only cache misses to a database beside a cache", () => {
    const { nodes, edges } = threeTier();
    const s = simulate(nodes, edges, 1000);
    expect(s.nodes.cache.inRps).toBeCloseTo(1000);
    expect(s.nodes.db.inRps).toBeCloseTo(200); // default hit rate 80%
  });

  it("respects an explicit call ratio over the cache-aside default", () => {
    const { nodes, edges } = threeTier();
    edges[3] = edge("api", "db", 1);
    expect(simulate(nodes, edges, 1000).nodes.db.inRps).toBeCloseTo(1000);
  });

  it("splits router traffic by edge weight", () => {
    const s = simulate(
      [node("c", "client"), node("lb", "load_balancer"), node("a", "service"), node("b", "service")],
      [edge("c", "lb"), edge("lb", "a", 1), edge("lb", "b", 3)],
      800,
    );
    expect(s.nodes.a.inRps).toBeCloseTo(200);
    expect(s.nodes.b.inRps).toBeCloseTo(600);
  });

  it("shards across stores when a router has nothing but stores behind it", () => {
    const s = simulate(
      [node("c", "client"), node("ring", "load_balancer"), node("a", "cache"), node("b", "cache"), node("db", "sql_db")],
      [edge("c", "ring"), edge("ring", "a"), edge("ring", "b"), edge("a", "db"), edge("b", "db")],
      1000,
    );
    expect(s.nodes.a.inRps).toBeCloseTo(500);
    expect(s.nodes.b.inRps).toBeCloseTo(500);
    expect(s.nodes.db.inRps).toBeCloseTo(200); // both shards' 20% misses
  });

  it("treats stores beside a router as per-request side-calls", () => {
    const s = simulate(
      [node("c", "client"), node("rl", "rate_limiter", { rateLimit: 10_000 }), node("redis", "cache"), node("api", "service")],
      [edge("c", "rl"), edge("rl", "redis"), edge("rl", "api")],
      1000,
    );
    expect(s.nodes.redis.inRps).toBeCloseTo(1000);
    expect(s.nodes.api.inRps).toBeCloseTo(1000);
  });
});

describe("capacity and latency", () => {
  it("drops the excess once a node is past capacity", () => {
    // 3 × 800 = 2,400 rps of capacity against 3,000 offered.
    const s = simulate([node("c", "client"), node("api", "service")], [edge("c", "api")], 3000, 20);
    expect(s.nodes.api.status).toBe("overloaded");
    expect(s.nodes.api.outRps).toBeCloseTo(2400);
    expect(s.errorPct).toBeCloseTo(20, 0);
  });

  it("raises latency as utilization climbs", () => {
    const at = (rps: number) => simulate([node("c", "client"), node("api", "service")], [edge("c", "api")], rps).latencyMs;
    expect(at(500)).toBeLessThan(at(1500));
    expect(at(1500)).toBeLessThan(at(2200));
  });

  it("rejects traffic above a rate limit with 429s", () => {
    const s = simulate(
      [node("c", "client"), node("rl", "rate_limiter", { rateLimit: 1000 }), node("api", "service")],
      [edge("c", "rl"), edge("rl", "api")],
      2000,
    );
    expect(s.nodes.rl.throttleRps).toBeCloseTo(1000);
    expect(s.nodes.api.inRps).toBeCloseTo(1000);
    expect(s.errorPct).toBeCloseTo(50);
  });
});

describe("failures", () => {
  it("fails only the requests that need a dead database", () => {
    const { nodes, edges } = threeTier({ down: true });
    const s = simulate(nodes, edges, 1000);
    expect(s.nodes.db.status).toBe("down");
    expect(s.errorPct).toBeCloseTo(20); // the 20% cache misses
  });

  it("routes around a dead instance behind a load balancer", () => {
    const s = simulate(
      [node("c", "client"), node("lb", "load_balancer"), node("a", "service"), node("b", "service", { down: true })],
      [edge("c", "lb"), edge("lb", "a"), edge("lb", "b")],
      1000,
    );
    expect(s.nodes.a.inRps).toBeCloseTo(1000);
    expect(s.nodes.b.inRps).toBe(0);
    expect(s.errorPct).toBe(0);
  });
});

describe("queues", () => {
  it("grows a backlog when producers outpace consumers", () => {
    // Workers: 2 × 200 = 400/s against 1,000/s of messages → +600 per second.
    const s = simulate(
      [node("c", "client"), node("api", "service"), node("q", "queue"), node("w", "worker")],
      [edge("c", "api"), edge("api", "q"), edge("q", "w")],
      1000,
      5,
    );
    expect(s.nodes.q.backlog).toBeCloseTo(3000, -2);
    expect(s.nodes.w.inRps).toBeCloseTo(400);
    expect(s.nodes.w.demandRps).toBeCloseTo(1000);
    expect(s.errorPct).toBe(0); // async: producers aren't failed by a slow consumer
  });

  it("only charges producers the enqueue latency", () => {
    const s = simulate(
      [node("c", "client"), node("api", "service"), node("q", "queue"), node("w", "worker", { latencyMs: 5000 })],
      [edge("c", "api"), edge("api", "q"), edge("q", "w")],
      100,
    );
    expect(s.latencyMs).toBeLessThan(100);
  });
});

describe("graph compilation", () => {
  it("ignores edges that close a cycle", () => {
    const g = compile(
      [node("c", "client"), node("a", "service"), node("b", "service")],
      [edge("c", "a"), edge("a", "b"), edge("b", "a")],
    );
    expect(g.ignoredEdges).toEqual(["b->a"]);
    expect(g.order.indexOf("a")).toBeLessThan(g.order.indexOf("b"));
  });

  it("reports nodes nobody calls as idle", () => {
    const s = simulate([node("c", "client"), node("api", "service"), node("db", "sql_db")], [edge("c", "api"), edge("db", "api")], 500);
    expect(s.nodes.db.status).toBe("idle");
  });
});
