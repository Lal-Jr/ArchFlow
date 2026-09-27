import type { ComponentType } from "./catalog";
import type { Checkpoint } from "./problems";

export interface GraphNode {
  id: string;
  type: ComponentType;
}
export interface GraphEdge {
  source: string;
  target: string;
}

export interface CheckResult {
  checkpoint: Checkpoint;
  passed: boolean;
}

/** Edges count in either direction — beginners often draw arrows the "wrong" way. */
function connected(nodes: GraphNode[], edges: GraphEdge[], from: ComponentType[], to: ComponentType[]) {
  const typeOf = new Map(nodes.map((n) => [n.id, n.type]));
  return edges.some((e) => {
    const a = typeOf.get(e.source);
    const b = typeOf.get(e.target);
    if (!a || !b) return false;
    return (from.includes(a) && to.includes(b)) || (from.includes(b) && to.includes(a));
  });
}

export function grade(checkpoints: Checkpoint[], nodes: GraphNode[], edges: GraphEdge[]) {
  const results: CheckResult[] = checkpoints.map((cp) => {
    if (cp.kind === "component") {
      const count = nodes.filter((n) => cp.types.includes(n.type)).length;
      return { checkpoint: cp, passed: count >= (cp.min ?? 1) };
    }
    return { checkpoint: cp, passed: connected(nodes, edges, cp.from, cp.to) };
  });
  const passed = results.filter((r) => r.passed).length;
  return { results, passed, total: results.length, score: Math.round((passed / results.length) * 100) };
}
