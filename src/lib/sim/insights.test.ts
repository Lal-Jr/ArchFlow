import { describe, expect, it } from "vitest";
import { compile, initialState, tick } from "./engine";
import { deriveInsights } from "./insights";
import { edge, node } from "./testing";

function insightsFor(nodes: ReturnType<typeof node>[], edges: ReturnType<typeof edge>[], rps: number) {
  const g = compile(nodes, edges);
  const st = initialState();
  let s = tick(g, st, 0.1, rps);
  for (let i = 0; i < 100; i++) s = tick(g, st, 0.1, rps);
  return deriveInsights(g, s);
}

describe("deriveInsights", () => {
  it("explains an endpoint that nothing behind a router handles", () => {
    const ins = insightsFor(
      [
        {
          ...node("c", "client"),
          endpoints: [
            { method: "GET", path: "/a", share: 1 },
            { method: "POST", path: "/b", share: 1 },
          ],
        },
        node("lb", "load_balancer"),
        { ...node("api", "service"), serves: ["GET /a"] },
      ],
      [edge("c", "lb"), edge("lb", "api")],
      100,
    );
    const r = ins.find((i) => i.id === "reject-lb")!;
    expect(r.title).toBe("lb has nowhere to send POST /b");
    expect(r.severity).toBe("critical");
    // The unrouted endpoint isn't also reported as "starved".
    expect(ins.some((i) => i.id === "starved-POST /b")).toBe(false);
  });

  it("tells a crowded-out endpoint to get a service of its own", () => {
    const mix = {
      endpoints: [
        { method: "GET" as const, path: "/feed", share: 95 },
        { method: "POST" as const, path: "/posts", share: 5 },
      ],
    };
    // Reads mostly stop at the cache; writes all reach the database, which both share and which is overloaded.
    const crowded = insightsFor(
      [
        { ...node("c", "client"), ...mix },
        node("api", "service", { replicas: 200 }),
        node("cache", "cache", { hitRate: 0.99, replicas: 4 }),
        node("db", "sql_db"),
      ],
      [edge("c", "api"), edge("api", "cache"), edge("api", "db")],
      100_000,
    );
    const w = crowded.find((i) => i.id === "starved-POST /posts")!;
    expect(w.nodeId).toBe("db");
    expect(w.detail).toMatch(/shares db with heavier traffic/);

    const ins = insightsFor(
      [
        { ...node("c", "client"), ...mix },
        node("lb", "load_balancer"),
        { ...node("read", "service", { replicas: 10 }), serves: ["GET /feed"] },
        { ...node("write", "service", { replicas: 1, capacity: 100 }), serves: ["POST /posts"] },
      ],
      [edge("c", "lb"), edge("lb", "read"), edge("lb", "write")],
      4000,
    );
    const own = ins.find((i) => i.id === "starved-POST /posts")!;
    expect(own.severity).toBe("warning");
    expect(own.nodeId).toBe("write");
    expect(own.detail).toMatch(/own path is overloaded at write/);
  });

  it("names the bottleneck and the replicas that would fix it", () => {
    const ins = insightsFor([node("c", "client"), node("api", "service")], [edge("c", "api")], 3000);
    const b = ins.find((i) => i.id === "hot-api")!;
    expect(b.severity).toBe("critical");
    expect(b.detail).toMatch(/Scale to ~6 replicas/); // 3000 / (800 × 0.7) = 5.4 → 6
  });

  it("flags a queue with no consumers", () => {
    const ins = insightsFor([node("c", "client"), node("api", "service"), node("q", "queue")], [edge("c", "api"), edge("api", "q")], 100);
    expect(ins.some((i) => i.id === "noconsumer-q")).toBe(true);
  });

  it("reports a healthy system when nothing is hot", () => {
    const ins = insightsFor([node("c", "client"), node("api", "service", { replicas: 2 })], [edge("c", "api")], 100);
    expect(ins.some((i) => i.id === "healthy")).toBe(true);
  });

  it("sorts critical insights first", () => {
    const ins = insightsFor([node("c", "client"), node("api", "service", { replicas: 1 })], [edge("c", "api")], 3000);
    expect(ins[0].severity).toBe("critical");
  });

  it("calls out a retry storm", () => {
    const ins = insightsFor(
      [node("c", "client"), node("api", "service", { retries: 3 }), node("db", "sql_db", { capacity: 500 })],
      [edge("c", "api"), edge("api", "db")],
      1000,
    );
    expect(ins.some((i) => i.id === "storm-api->db" && i.severity === "critical")).toBe(true);
  });

  it("explains an open circuit breaker", () => {
    const ins = insightsFor(
      [node("c", "client"), node("api", "service", { circuitBreaker: true }), node("db", "sql_db", { down: true })],
      [edge("c", "api"), edge("api", "db")],
      500,
    );
    expect(ins.some((i) => i.id === "breaker-api->db")).toBe(true);
  });

  it("suggests a breaker when a service keeps waiting on a dead dependency", () => {
    const ins = insightsFor(
      [node("c", "client"), node("api", "service"), node("db", "sql_db", { down: true })],
      [edge("c", "api"), edge("api", "db")],
      500,
    );
    expect(ins.some((i) => i.id === "nobreaker-api->db")).toBe(true);
  });
});
