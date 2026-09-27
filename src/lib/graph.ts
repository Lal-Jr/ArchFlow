import { Position, type Edge, type Node } from "@xyflow/react";
import type { ComponentType } from "./catalog";
import type { Problem } from "./problems";
import { resolveConfig, type NodeConfig } from "./sim/config";
import type { SimEdge, SimNode } from "./sim/engine";

export type ArchNodeData = {
  kind: ComponentType;
  label: string;
  config?: Partial<NodeConfig>;
  /** Walkthrough emphasis: the step being explained, or an unrevealed step. */
  emphasis?: "current" | "dim";
};
export type ArchNodeType = Node<ArchNodeData, "arch">;

export type FlowEdgeData = { ratio?: number; label?: string; /** Walkthrough: edge touching the current step. */ highlight?: boolean };
export type FlowEdgeType = Edge<FlowEdgeData, "flow">;

export const COL_W = 260;
export const ROW_H = 130;

/** Connect two grid positions on the sides that face each other. */
export function pickHandles(a: { col: number; row: number }, b: { col: number; row: number }) {
  const dx = (b.col - a.col) * COL_W;
  const dy = (b.row - a.row) * ROW_H;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: Position.Right, targetHandle: Position.Left }
      : { sourceHandle: Position.Left, targetHandle: Position.Right };
  }
  return dy >= 0
    ? { sourceHandle: Position.Bottom, targetHandle: Position.Top }
    : { sourceHandle: Position.Top, targetHandle: Position.Bottom };
}

export function solutionToGraph(problem: Problem): { nodes: ArchNodeType[]; edges: FlowEdgeType[] } {
  const byId = new Map(problem.solution.nodes.map((n) => [n.id, n]));
  return {
    nodes: problem.solution.nodes.map((n) => ({
      id: n.id,
      type: "arch",
      position: { x: n.col * COL_W, y: n.row * ROW_H },
      data: { kind: n.type, label: n.label, config: n.config },
    })),
    edges: problem.solution.edges.map((e) => ({
      id: `${e.from}-${e.to}`,
      type: "flow",
      source: e.from,
      target: e.to,
      ...pickHandles(byId.get(e.from)!, byId.get(e.to)!),
      data: { ratio: e.ratio, label: e.label },
    })),
  };
}

export function toSim(nodes: ArchNodeType[], edges: FlowEdgeType[]): { nodes: SimNode[]; edges: SimEdge[] } {
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label, config: resolveConfig(n.data.kind, n.data.config) })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, ratio: e.data?.ratio })),
  };
}

/** Builds a graph laid out on the grid: nodes as [id, kind, label, col, row, config?], links as [from, to, ratio?]. */
export function gridGraph(
  spec: [string, ComponentType, string, number, number, Partial<NodeConfig>?][],
  links: [string, string, number?][],
): { nodes: ArchNodeType[]; edges: FlowEdgeType[] } {
  const pos = new Map(spec.map(([id, , , col, row]) => [id, { col, row }]));
  return {
    nodes: spec.map(([id, kind, label, col, row, config]) => ({
      id,
      type: "arch",
      position: { x: col * COL_W, y: row * ROW_H },
      data: { kind, label, ...(config ? { config } : {}) },
    })),
    edges: links.map(([s, t, ratio]) => ({
      id: `${s}-${t}`,
      type: "flow",
      source: s,
      target: t,
      ...pickHandles(pos.get(s)!, pos.get(t)!),
      data: { ratio },
    })),
  };
}
