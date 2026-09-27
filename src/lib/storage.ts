import type { ArchNodeType, FlowEdgeType } from "./graph";

export interface SavedDesign {
  nodes: ArchNodeType[];
  edges: FlowEdgeType[];
}

const designKey = (key: string) => `archflow:design:${key}`;
const bestKey = (slug: string) => `archflow:best:${slug}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — progress just won't persist.
  }
}

/** Loads a design, upgrading edges saved by the pre-simulator version. */
export function loadDesign(key: string): SavedDesign | null {
  const saved = read<SavedDesign & { bestScore?: number }>(designKey(key));
  if (!saved) return null;
  if (saved.bestScore && !read(bestKey(key))) write(bestKey(key), saved.bestScore);
  return {
    nodes: saved.nodes,
    edges: saved.edges.map((e) => {
      const legacyLabel = (e as { label?: unknown }).label;
      return {
        id: e.id,
        type: "flow",
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: { ...e.data, label: e.data?.label ?? (typeof legacyLabel === "string" ? legacyLabel : undefined) },
      };
    }),
  };
}

export function saveDesign(key: string, design: SavedDesign) {
  write(designKey(key), design);
}

export function clearDesign(key: string) {
  try {
    localStorage.removeItem(designKey(key));
  } catch {}
}

export function loadBest(slug: string): number {
  return read<number>(bestKey(slug)) ?? read<{ bestScore?: number }>(designKey(slug))?.bestScore ?? 0;
}

export function saveBest(slug: string, score: number) {
  write(bestKey(slug), score);
}

export interface ChallengeBest {
  passed: boolean;
  /** Peak monthly cost of the cheapest passing run. */
  cost: number;
}

const challengeKey = (id: string) => `archflow:challenge:${id}`;

export function loadChallengeBest(id: string): ChallengeBest | null {
  return read<ChallengeBest>(challengeKey(id));
}

/** Keeps the cheapest passing run. */
export function saveChallengeBest(id: string, result: ChallengeBest) {
  const prev = loadChallengeBest(id);
  if (!result.passed) return;
  if (prev?.passed && prev.cost <= result.cost) return;
  write(challengeKey(id), result);
}
