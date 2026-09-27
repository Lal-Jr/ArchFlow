import { describe, expect, it } from "vitest";
import { grade } from "./grader";
import { solutionToGraph, toSim } from "./graph";
import { PROBLEMS } from "./problems";
import { simulate } from "./sim/testing";

describe.each(PROBLEMS.map((p) => [p.slug, p] as const))("%s reference solution", (_, problem) => {
  const graph = solutionToGraph(problem);

  it("passes every one of its own checkpoints", () => {
    const result = grade(
      problem.checkpoints,
      graph.nodes.map((n) => ({ id: n.id, type: n.data.kind })),
      graph.edges,
    );
    expect(result.results.filter((r) => !r.passed).map((r) => r.checkpoint.id)).toEqual([]);
  });

  it("is healthy at the default 1,000 rps", () => {
    const sim = toSim(graph.nodes, graph.edges);
    const s = simulate(sim.nodes, sim.edges, 1000, 30);
    expect(s.errorPct).toBe(0);
    expect(Object.values(s.nodes).filter((m) => m.status === "overloaded")).toEqual([]);
  });

  it("has a walkthrough note for every node", () => {
    for (const n of problem.solution.nodes) expect(n.note.length).toBeGreaterThan(10);
  });
});

describe("problem library", () => {
  it("has unique slugs", () => {
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(PROBLEMS.length);
  });

  it.each(PROBLEMS.map((p) => [p.slug, p] as const))("%s explains the why and how", (_, p) => {
    expect(p.concepts.length).toBeGreaterThanOrEqual(3);
    expect(p.api.length).toBeGreaterThanOrEqual(2);
    expect(p.dataModel.length).toBeGreaterThanOrEqual(2);
    expect(p.decisions.length).toBeGreaterThanOrEqual(3);
    expect(p.deepDives.length).toBeGreaterThanOrEqual(3);
    expect(p.mistakes.length).toBeGreaterThanOrEqual(3);
    for (const d of p.dataModel) expect(d.why.length).toBeGreaterThan(20);
  });

  it.each(PROBLEMS.map((p) => [p.slug, p] as const))("%s has a well-formed solution graph", (_, p) => {
    const ids = p.solution.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of p.solution.edges) {
      expect(ids).toContain(e.from);
      expect(ids).toContain(e.to);
    }
  });
});
