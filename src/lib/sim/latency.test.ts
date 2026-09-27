import { describe, expect, it } from "vitest";
import { compress, convolve, mean, mix, ownLatency, point, quantile } from "./latency";
import { edge, node, simulate } from "./testing";

describe("latency distributions", () => {
  it("keep their mean and total probability through convolution", () => {
    const a = ownLatency(20, 20);
    const b = ownLatency(10, 10);
    const c = convolve(a, b);
    expect(c.reduce((s, x) => s + x.p, 0)).toBeCloseTo(1);
    expect(mean(c)).toBeCloseTo(30, 0);
  });

  it("compress onto a bounded number of points", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ v: i, p: 1 / 5000 }));
    expect(compress(many).length).toBeLessThanOrEqual(32);
  });

  it("put the unassigned weight of a mixture at zero", () => {
    const d = mix([{ w: 0.2, d: point(100) }]);
    expect(quantile(d, 0.5)).toBe(0);
    expect(quantile(d, 0.99)).toBe(100);
  });

  it("have a long tail once queueing kicks in", () => {
    const d = ownLatency(40, 20); // 20ms of service, 30ms more from queueing
    expect(quantile(d, 0.99)).toBeGreaterThan(3 * mean(d));
  });
});

describe("tail latency in the simulation", () => {
  it("orders the percentiles and puts p99 above the average", () => {
    const s = simulate([node("c", "client"), node("api", "service")], [edge("c", "api")], 1000);
    expect(s.p50Ms).toBeLessThanOrEqual(s.p95Ms);
    expect(s.p95Ms).toBeLessThanOrEqual(s.p99Ms);
    expect(s.p99Ms).toBeGreaterThan(s.latencyMs);
  });

  it("shows cache misses in the tail but not the median", () => {
    const s = simulate(
      [node("c", "client"), node("api", "service"), node("cache", "cache"), node("db", "sql_db", { latencyMs: 200 })],
      [edge("c", "api"), edge("api", "cache"), edge("api", "db")],
      500,
    );
    expect(s.p50Ms).toBeLessThan(100);
    expect(s.p99Ms).toBeGreaterThan(200);
  });

  it("grows faster than the average as a node saturates", () => {
    const at = (rps: number) => simulate([node("c", "client"), node("api", "service")], [edge("c", "api")], rps);
    const low = at(500);
    const high = at(2200);
    expect(high.p99Ms - low.p99Ms).toBeGreaterThan(high.latencyMs - low.latencyMs);
  });
});
