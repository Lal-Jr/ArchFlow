/** Helpers for building small graphs in tests. */
import type { ComponentType } from "../catalog";
import { resolveConfig, type NodeConfig } from "./config";
import { compile, initialState, tick, type SimEdge, type SimNode, type Snapshot } from "./engine";

export const node = (id: string, kind: ComponentType, config: Partial<NodeConfig> = {}): SimNode => ({
  id,
  kind,
  label: id,
  config: resolveConfig(kind, config),
});

export const edge = (source: string, target: string, ratio?: number): SimEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  ratio,
});

/** Runs `seconds` of simulated time at a constant rate and returns the last snapshot. */
export function simulate(nodes: SimNode[], edges: SimEdge[], rps: number, seconds = 10): Snapshot {
  const g = compile(nodes, edges);
  const state = initialState();
  let snap!: Snapshot;
  for (let i = 0; i < seconds * 10; i++) snap = tick(g, state, 0.1, rps);
  return snap;
}
