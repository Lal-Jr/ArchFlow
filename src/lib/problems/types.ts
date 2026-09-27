import type { ComponentType } from "../catalog";
import type { NodeConfig } from "../sim/config";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface SolutionNode {
  id: string;
  type: ComponentType;
  label: string;
  /** Grid column / row — converted to pixels when rendered. */
  col: number;
  row: number;
  note: string;
  /** Simulation overrides; otherwise the component's defaults apply. */
  config?: Partial<NodeConfig>;
}

export interface SolutionEdge {
  from: string;
  to: string;
  label?: string;
  /** Calls per request (fan-out) or traffic weight (routers). See SimEdge.ratio. */
  ratio?: number;
}

export type Checkpoint =
  | {
      id: string;
      kind: "component";
      title: string;
      types: ComponentType[];
      min?: number;
      hint: string;
      why: string;
    }
  | {
      id: string;
      kind: "connection";
      title: string;
      from: ComponentType[];
      to: ComponentType[];
      hint: string;
      why: string;
    };

export type ProblemCategory =
  | "Social"
  | "Messaging"
  | "Media"
  | "Storage"
  | "Search"
  | "Commerce"
  | "Location"
  | "Collaboration"
  | "Data"
  | "Infrastructure";

export interface ApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "WS";
  path: string;
  purpose: string;
}

export interface DataEntity {
  entity: string;
  /** Where it lives, e.g. "Cassandra" or "Redis sorted set". */
  store: string;
  fields: string;
  /** Why that store fits the access pattern. */
  why: string;
}

export interface Problem {
  slug: string;
  title: string;
  tagline: string;
  difficulty: Difficulty;
  category: ProblemCategory;
  /**
   * Companies where public interview guides report this question being asked.
   * Only sourced attributions — empty when there's no reliable source.
   */
  askedAt: string[];
  /** The core ideas the question tests. */
  concepts: string[];
  functional: string[];
  nonFunctional: string[];
  estimates: string[];
  api: ApiEndpoint[];
  dataModel: DataEntity[];
  checkpoints: Checkpoint[];
  solution: { nodes: SolutionNode[]; edges: SolutionEdge[] };
  /** "Why X and not Y?" — the reasoning behind the design's key choices. */
  decisions: { q: string; a: string }[];
  deepDives: { q: string; a: string }[];
  mistakes: string[];
}

export const ENTRY: ComponentType[] = ["load_balancer", "api_gateway"];
export const DB: ComponentType[] = ["sql_db", "nosql_db"];
export const ASYNC: ComponentType[] = ["queue", "stream"];
