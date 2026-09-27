import { describe, expect, it } from "vitest";
import { grade } from "./grader";
import type { Checkpoint } from "./problems";

const checkpoints: Checkpoint[] = [
  { id: "cache", kind: "component", title: "", types: ["cache"], hint: "", why: "" },
  { id: "two", kind: "component", title: "", types: ["service"], min: 2, hint: "", why: "" },
  { id: "link", kind: "connection", title: "", from: ["service"], to: ["cache"], hint: "", why: "" },
];

describe("grade", () => {
  it("scores the share of passed checkpoints", () => {
    const r = grade(checkpoints, [{ id: "s", type: "service" }, { id: "c", type: "cache" }], [{ source: "s", target: "c" }]);
    expect(r.passed).toBe(2);
    expect(r.score).toBe(67);
  });

  it("accepts connections drawn in either direction", () => {
    const r = grade(checkpoints, [{ id: "s", type: "service" }, { id: "c", type: "cache" }], [{ source: "c", target: "s" }]);
    expect(r.results.find((x) => x.checkpoint.id === "link")!.passed).toBe(true);
  });
});
