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
