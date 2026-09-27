"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ArchNodeType, FlowEdgeType } from "@/lib/graph";
import { toSim } from "@/lib/graph";
import { compile, initialState, tick, type Snapshot } from "@/lib/sim/engine";
import { SimStore } from "@/lib/sim/store";
import { offeredRps, type Pattern } from "@/lib/sim/traffic";

const TICK_S = 0.1;

export function useSimulation(nodes: ArchNodeType[], edges: FlowEdgeType[]) {
  const [store] = useState(() => new SimStore());
  const [running, setRunning] = useState(false);
  const [rps, setRps] = useState(1000);
  const [pattern, setPattern] = useState<Pattern>("steady");
  const [speed, setSpeed] = useState(1);

  // Recompile only when something the engine cares about changes — not on every drag.
  const simKey = JSON.stringify(toSim(nodes, edges));
  const compiled = useMemo(() => {
    const g = JSON.parse(simKey) as ReturnType<typeof toSim>;
    return compile(g.nodes, g.edges);
  }, [simKey]);

  const stateRef = useRef(initialState());
  const live = useRef({ compiled, rps, pattern, speed });
  useEffect(() => {
    live.current = { compiled, rps, pattern, speed };
  }, [compiled, rps, pattern, speed]);

  useEffect(() => {
    if (!running) return;
    // Advance by wall-clock time, not interval count, so throttled timers (background tabs,
    // stalled frames) catch up instead of slowing simulated time down.
    let last = performance.now();
    let owed = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const { compiled: g, rps: base, pattern: p, speed } = live.current;
      owed = Math.min(owed + ((now - last) / 1000 / TICK_S) * speed, 300);
      last = now;
      const st = stateRef.current;
      let snap: Snapshot | null = null;
      // Tail latency is the costly part, so only the tick that gets displayed computes it.
      for (; owed >= 1; owed--) snap = tick(g, st, TICK_S, offeredRps(p, base, st.t), { tail: owed < 2 });
      if (snap) store.set(snap);
    }, TICK_S * 1000);
    return () => clearInterval(id);
  }, [running, store]);

  const reset = () => {
    setRunning(false);
    stateRef.current = initialState();
    store.set(null);
  };

  return { store, compiled, running, setRunning, rps, setRps, pattern, setPattern, speed, setSpeed, reset };
}

export type Simulation = ReturnType<typeof useSimulation>;

export const SimContext = createContext<SimStore | null>(null);

const noop = () => () => {};

export function useSnapshot(): Snapshot | null {
  const store = useContext(SimContext);
  return useSyncExternalStore(store?.subscribe ?? noop, () => store?.get() ?? null, () => null);
}
