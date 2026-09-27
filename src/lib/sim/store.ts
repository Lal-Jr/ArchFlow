import type { Snapshot } from "./engine";

/** Tiny external store so nodes and edges can subscribe to live metrics without re-creating the graph each tick. */
export class SimStore {
  private snapshot: Snapshot | null = null;
  private listeners = new Set<() => void>();

  get = () => this.snapshot;

  set(s: Snapshot | null) {
    this.snapshot = s;
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}
