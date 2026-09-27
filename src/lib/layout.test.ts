import { describe, expect, it } from "vitest";
import { tidyLayout } from "./layout";
import { compile } from "./sim/engine";
import { edge, node } from "./sim/testing";

describe("tidyLayout", () => {
  it("places each node one column right of its furthest caller", () => {
    const g = compile(
      [node("c", "client"), node("lb", "load_balancer"), node("api", "service"), node("db", "sql_db")],
      [edge("c", "lb"), edge("lb", "api"), edge("api", "db"), edge("c", "db")],
    );
    const pos = tidyLayout(g, {});
    expect([pos.c.x, pos.lb.x, pos.api.x, pos.db.x]).toEqual([0, 280, 560, 840]);
  });

  it("keeps siblings in their current vertical order", () => {
    const g = compile([node("c", "client"), node("a", "service"), node("b", "service")], [edge("c", "a"), edge("c", "b")]);
    const pos = tidyLayout(g, { a: 500, b: 100 });
    expect(pos.b.y).toBeLessThan(pos.a.y);
  });
});
