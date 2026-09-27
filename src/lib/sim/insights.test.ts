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
});
