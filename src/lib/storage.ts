import type { Edge, Node } from "@xyflow/react";

export interface SavedDesign {
  nodes: Node[];
  edges: Edge[];
  bestScore: number;
}

const key = (slug: string) => `archflow:design:${slug}`;

export function loadDesign(slug: string): SavedDesign | null {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as SavedDesign) : null;
  } catch {
    return null;
  }
}

export function saveDesign(slug: string, design: SavedDesign) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(design));
  } catch {
    // Storage full or blocked — progress just won't persist.
  }
}

export function clearDesign(slug: string) {
  try {
    localStorage.removeItem(key(slug));
  } catch {}
}
