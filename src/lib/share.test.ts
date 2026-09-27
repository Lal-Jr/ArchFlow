import { describe, expect, it } from "vitest";
import { solutionToGraph } from "./graph";
import { PROBLEMS } from "./problems";
import { decodeDesign, encodeDesign } from "./share";

describe("share links", () => {
  it("round-trips a design, including configs, ratios and labels", async () => {
    const g = solutionToGraph(PROBLEMS.find((p) => p.slug === "video-streaming")!);
    const back = await decodeDesign(await encodeDesign(g));
    expect(back.nodes.map((n) => [n.id, n.data.kind, n.data.label, n.position, n.data.config])).toEqual(
      g.nodes.map((n) => [n.id, n.data.kind, n.data.label, n.position, n.data.config]),
    );
    expect(back.edges.map((e) => [e.source, e.target, e.data?.ratio, e.data?.label])).toEqual(
      g.edges.map((e) => [e.source, e.target, e.data?.ratio, e.data?.label]),
    );
  });

  it("stays short enough to paste anywhere", async () => {
    const g = solutionToGraph(PROBLEMS.find((p) => p.slug === "news-feed")!);
    expect((await encodeDesign(g)).length).toBeLessThan(1500);
  });

  it("rejects garbage", async () => {
    await expect(decodeDesign("not-a-real-design")).rejects.toThrow();
  });

  it("drops unknown config keys and bad values from untrusted links", async () => {
    const g = solutionToGraph(PROBLEMS[0]);
    g.nodes[1].data.config = { replicas: 4, evil: "<script>", capacity: -5 } as never;
    const back = await decodeDesign(await encodeDesign(g));
    expect(back.nodes[1].data.config).toEqual({ replicas: 4 });
  });
});
