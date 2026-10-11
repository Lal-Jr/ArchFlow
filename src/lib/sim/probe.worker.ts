/** Runs capacity probes off the main thread, so the editor stays responsive while a large design is measured. */
import type { SimEdge, SimNode } from "./engine";
import { probeCapacity, type ProbeResult } from "./probe";

export type ProbeRequest = { id: number; nodes: SimNode[]; edges: SimEdge[] };
export type ProbeMessage = { id: number; progress: number } | { id: number; result: ProbeResult };

const scope = self as unknown as { onmessage: ((e: MessageEvent<ProbeRequest>) => void) | null; postMessage: (m: ProbeMessage) => void };

scope.onmessage = ({ data: { id, nodes, edges } }) => {
  const result = probeCapacity(nodes, edges, (done, estimate) => scope.postMessage({ id, progress: Math.min(0.97, done / estimate) }));
  scope.postMessage({ id, result });
};
