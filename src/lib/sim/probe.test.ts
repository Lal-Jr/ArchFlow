import { describe, expect, it } from "vitest";
import { fingerprint, probeCapacity } from "./probe";
import { edge, node } from "./testing";

const oneBox = () => ({
  nodes: [node("c", "client"), node("lb", "load_balancer"), node("api", "service"), node("db", "sql_db")],
  edges: [edge("c", "lb"), edge("lb", "api"), edge("api", "db")],
});

describe("capacity probe", () => {
  it("finds the ceiling just under the bottleneck's capacity", () => {
    const { nodes, edges } = oneBox();
    const r = probeCapacity(nodes, edges);
    // The API servers (3 × 800 = 2,400) give out before the database (1 × 2,500).
    expect(r.ceilingRps).toBeGreaterThan(2000);
    expect(r.ceilingRps).toBeLessThanOrEqual(2400);
    expect(r.limit?.nodeId).toBe("api");
    expect(r.capped).toBe(false);
  });

  it("is deterministic: the same design always measures the same", () => {
    const a = oneBox();
    const b = oneBox();
    expect(probeCapacity(a.nodes, a.edges)).toEqual(probeCapacity(b.nodes, b.edges));
  });

  it("moves the ceiling only when the real constraint moves", () => {
    const more = oneBox();
    more.nodes[2] = node("api", "service", { replicas: 6 });
    const r = probeCapacity(more.nodes, more.edges);
    expect(r.limit?.nodeId).toBe("db");
    expect(r.ceilingRps).toBeLessThanOrEqual(2500);

    const cached = oneBox();
    cached.nodes[2] = node("api", "service", { replicas: 6 });
    cached.nodes.push(node("cache", "cache"));
    cached.edges.push(edge("api", "cache"));
    expect(probeCapacity(cached.nodes, cached.edges).ceilingRps).toBeGreaterThan(r.ceilingRps * 1.5);
  });

  it("reports zero when even light traffic fails", () => {
    const { nodes, edges } = oneBox();
    nodes[3] = node("db", "sql_db", { down: true });
    const r = probeCapacity(nodes, edges);
    expect(r.ceilingRps).toBe(0);
    expect(r.limit?.nodeId).toBe("db");
  });

  it("flags a queue whose consumers fall behind", () => {
    const r = probeCapacity(
      [node("c", "client"), node("api", "service", { replicas: 20 }), node("q", "queue"), node("w", "worker")],
      [edge("c", "api"), edge("api", "q"), edge("q", "w")],
    );
    expect(r.verdict).toBe("backlog");
    expect(r.limit?.nodeId).toBe("q");
    expect(r.ceilingRps).toBeLessThanOrEqual(400); // 2 workers × 200
  });

  it("shows the isolation a read/write split buys, and what a shared pool buys instead", () => {
    const mix = [
      { method: "GET" as const, path: "/feed", share: 95 },
      { method: "POST" as const, path: "/posts", share: 5 },
    ];
    const design = (bound: boolean) => ({
      nodes: [
        { ...node("c", "client"), endpoints: mix },
        node("lb", "load_balancer"),
        { ...node("read", "service"), ...(bound ? { serves: ["GET /feed"] } : {}) },
        { ...node("write", "service", { replicas: 2 }), ...(bound ? { serves: ["POST /posts"] } : {}) },
        node("db", "nosql_db"),
      ],
      edges: [edge("c", "lb"), edge("lb", "read"), edge("lb", "write"), edge("read", "db"), edge("write", "db")],
    });
    const split = design(true);
    const shared = design(false);
    const s = probeCapacity(split.nodes, split.edges);
    const m = probeCapacity(shared.nodes, shared.edges);
    // Pooling every replica sustains more steady traffic...
    expect(m.ceilingRps).toBeGreaterThan(s.ceilingRps);
    // ...but past the ceiling it fails every endpoint, while the split keeps writes working.
    expect(m.overload!.every((e) => !e.ok)).toBe(true);
    expect(s.overload!.find((e) => e.key === "POST /posts")!.ok).toBe(true);
    expect(s.overload!.find((e) => e.key === "GET /feed")!.ok).toBe(false);
  });

  it("skips the isolation test without a request mix", () => {
    const { nodes, edges } = oneBox();
    expect(probeCapacity(nodes, edges).overload).toBeNull();
  });

  it("reports progress as it searches", () => {
    const { nodes, edges } = oneBox();
    const seen: number[] = [];
    probeCapacity(nodes, edges, (done, estimate) => seen.push(done / estimate));
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.every((f) => f > 0 && f <= 1)).toBe(true);
  });

  it("fingerprints only what the engine reads", () => {
    const { nodes, edges } = oneBox();
    const renamed = nodes.map((n) => ({ ...n, label: `${n.label}!` }));
    expect(fingerprint(renamed, edges)).toBe(fingerprint(nodes, edges));
    const scaled = nodes.map((n) => (n.id === "api" ? node("api", "service", { replicas: 4 }) : n));
    expect(fingerprint(scaled, edges)).not.toBe(fingerprint(nodes, edges));
  });
});
