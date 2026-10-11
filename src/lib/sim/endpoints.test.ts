import { describe, expect, it } from "vitest";
import type { Endpoint } from "./endpoints";
import { requestMix } from "./endpoints";
import { edge, node, simulate } from "./testing";
import type { SimNode } from "./engine";

const withMix = (n: SimNode, endpoints: Endpoint[]): SimNode => ({ ...n, endpoints });
const serving = (n: SimNode, serves: string[]): SimNode => ({ ...n, serves });

const READS_AND_WRITES: Endpoint[] = [
  { method: "GET", path: "/items", share: 9 },
  { method: "POST", path: "/items", share: 1 },
];

describe("request mix", () => {
  it("normalizes shares and merges duplicates", () => {
    expect(
      requestMix([
        { method: "GET", path: "/a", share: 1 },
        { method: "GET", path: "/a", share: 1 },
        { method: "POST", path: "/b", share: 2 },
      ]),
    ).toEqual([
      ["GET /a", 0.5],
      ["POST /b", 0.5],
    ]);
  });

  it("falls back to one unlabelled stream", () => {
    expect(requestMix(undefined)).toEqual([["*", 1]]);
    expect(requestMix([{ method: "GET", path: "/a", share: 0 }])).toEqual([["*", 1]]);
  });
});

describe("endpoints in the engine", () => {
  const threeTier = () => ({
    nodes: [
      withMix(node("c", "client"), READS_AND_WRITES),
      node("api", "service", { replicas: 10 }),
      node("cache", "cache", { hitRate: 0.8 }),
      node("db", "sql_db", { replicas: 4 }),
    ],
    edges: [edge("c", "api"), edge("api", "cache"), edge("api", "db")],
  });

  it("sends writes past the cache to the database", () => {
    const { nodes, edges } = threeTier();
    const s = simulate(nodes, edges, 1000);
    // 900 reads → 20% misses = 180, plus all 100 writes.
    expect(s.nodes.db.inRps).toBeCloseTo(280);
    expect(s.nodes.cache.inRps).toBeCloseTo(1000);
  });

  it("reports metrics per endpoint", () => {
    const { nodes, edges } = threeTier();
    const s = simulate(nodes, edges, 1000);
    expect(s.endpoints.map((e) => e.key)).toEqual(["GET /items", "POST /items"]);
    expect(s.endpoints[0].offeredRps).toBeCloseTo(900);
    expect(s.endpoints[1].offeredRps).toBeCloseTo(100);
    expect(s.errorPct).toBe(0);
  });

  it("doesn't count a scheduler's jobs as an endpoint", () => {
    const s = simulate(
      [withMix(node("c", "client"), READS_AND_WRITES), node("api", "service"), node("cron", "scheduler"), node("db", "sql_db")],
      [edge("c", "api"), edge("api", "db"), edge("cron", "db")],
      100,
    );
    expect(s.endpoints.map((e) => e.key)).toEqual(["GET /items", "POST /items"]);
  });

  it("reports no endpoints when no client declares a mix", () => {
    const s = simulate([node("c", "client"), node("api", "service")], [edge("c", "api")], 100);
    expect(s.endpoints).toEqual([]);
  });

  it("routes each endpoint only to the services bound to it", () => {
    const s = simulate(
      [
        withMix(node("c", "client"), READS_AND_WRITES),
        node("lb", "load_balancer"),
        serving(node("reads", "service"), ["GET /items"]),
        serving(node("writes", "service"), ["POST /items"]),
      ],
      [edge("c", "lb"), edge("lb", "reads"), edge("lb", "writes")],
      1000,
    );
    expect(s.nodes.reads.inRps).toBeCloseTo(900);
    expect(s.nodes.writes.inRps).toBeCloseTo(100);
    expect(s.errorPct).toBe(0);
  });

  it("rejects an endpoint nothing behind the router handles", () => {
    const s = simulate(
      [withMix(node("c", "client"), READS_AND_WRITES), node("lb", "load_balancer"), serving(node("reads", "service"), ["GET /items"])],
      [edge("c", "lb"), edge("lb", "reads")],
      1000,
    );
    expect(s.nodes.lb.rejectRps).toBeCloseTo(100);
    expect(s.nodes.reads.inRps).toBeCloseTo(900);
    expect(s.endpoints[1].errorPct).toBeCloseTo(100);
    expect(s.endpoints[0].errorPct).toBe(0);
    expect(s.errorPct).toBeCloseTo(10);
  });

  it("starves writes that share an overloaded service with a read flood, but not once they are split", () => {
    const mix: Endpoint[] = [
      { method: "GET", path: "/feed", share: 95 },
      { method: "POST", path: "/posts", share: 5 },
    ];
    // 3 × 800 = 2,400 rps of capacity against 4,000 offered.
    const shared = simulate(
      [withMix(node("c", "client"), mix), node("lb", "load_balancer"), node("api", "service")],
      [edge("c", "lb"), edge("lb", "api")],
      4000,
      20,
    );
    expect(shared.endpoints[1].errorPct).toBeGreaterThan(30);

    const split = simulate(
      [
        withMix(node("c", "client"), mix),
        node("lb", "load_balancer"),
        serving(node("read", "service"), ["GET /feed"]),
        serving(node("write", "service", { replicas: 1 }), ["POST /posts"]),
      ],
      [edge("c", "lb"), edge("lb", "read"), edge("lb", "write")],
      4000,
      20,
    );
    expect(split.endpoints[1].errorPct).toBe(0);
    expect(split.endpoints[0].errorPct).toBeGreaterThan(30);
  });
});
