/**
 * "Tidy up": a layered left-to-right layout. Each node goes one column right of its
 * furthest caller (longest path from a source), and rows keep the current top-to-bottom order.
 */
import type { Compiled } from "./sim/engine";

export const LAYOUT_COL = 280;
export const LAYOUT_ROW = 130;

export function tidyLayout(g: Compiled, currentY: Record<string, number>): Record<string, { x: number; y: number }> {
  const layer: Record<string, number> = {};
  for (const id of g.order) layer[id] ??= 0;
  for (const id of g.order) {
    for (const l of g.out.get(id) ?? []) layer[l.to] = Math.max(layer[l.to] ?? 0, layer[id] + 1);
  }
  const columns = new Map<number, string[]>();
  for (const id of g.order) columns.set(layer[id], [...(columns.get(layer[id]) ?? []), id]);
  const tallest = Math.max(1, ...[...columns.values()].map((c) => c.length));

  const out: Record<string, { x: number; y: number }> = {};
  for (const [col, ids] of columns) {
    ids.sort((a, b) => (currentY[a] ?? 0) - (currentY[b] ?? 0));
    const offset = ((tallest - ids.length) * LAYOUT_ROW) / 2; // center shorter columns
    ids.forEach((id, i) => (out[id] = { x: col * LAYOUT_COL, y: offset + i * LAYOUT_ROW }));
  }
  return out;
}
