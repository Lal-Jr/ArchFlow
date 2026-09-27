"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ArchNodeType, FlowEdgeType } from "@/lib/graph";
import { toSim } from "@/lib/graph";
import { applyOverrides, snapshotCost, type Challenge } from "@/lib/challenges";
import { compile, initialState, tick, type HistoryPoint, type Snapshot } from "@/lib/sim/engine";
import { SimStore } from "@/lib/sim/store";
import { offeredRps, type Pattern } from "@/lib/sim/traffic";

const TICK_S = 0.1;

export interface Finished {
  history: HistoryPoint[];
  peakCost: number;
}

export function useSimulation(nodes: ArchNodeType[], edges: FlowEdgeType[], challenge?: Challenge) {
  const [store] = useState(() => new SimStore());
  const [running, setRunning] = useState(false);
  const [rps, setRps] = useState(1000);
  const [pattern, setPattern] = useState<Pattern>("steady");
  const [speed, setSpeed] = useState(1);
  const [finished, setFinished] = useState<Finished | null>(null);

  // Recompile only when something the engine cares about changes — not on every drag.
  const simKey = JSON.stringify(applyOverrides(toSim(nodes, edges), challenge?.overrides));
  const { sim, compiled } = useMemo(() => {
    const g = JSON.parse(simKey) as ReturnType<typeof toSim>;
    return { sim: g, compiled: compile(g.nodes, g.edges) };
  }, [simKey]);

  const traffic = challenge ? challenge.traffic : { pattern, rps };
  const stateRef = useRef(initialState());
  const peakRef = useRef(0);
  const live = useRef({ compiled, sim, traffic, speed, duration: challenge?.durationS });
  useEffect(() => {
    live.current = { compiled, sim, traffic, speed, duration: challenge?.durationS };
  });

  useEffect(() => {
    if (!running) return;
    // Advance by wall-clock time, not interval count, so throttled timers (background tabs,
    // stalled frames) catch up instead of slowing simulated time down.
    let last = performance.now();
    let owed = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const { compiled: g, sim: s, traffic: tr, speed: n, duration } = live.current;
      owed = Math.min(owed + ((now - last) / 1000 / TICK_S) * n, 300);
      last = now;
      const st = stateRef.current;
      let snap: Snapshot | null = null;
      let done = false;
      // Tail latency is the costly part, so only the tick that gets displayed computes it
      // (plus every tick of a timed run, whose p99 history is scored).
      for (; owed >= 1 && !done; owed--) {
        done = duration != null && st.t + TICK_S >= duration - 1e-9;
        snap = tick(g, st, TICK_S, offeredRps(tr.pattern, tr.rps, st.t), { tail: owed < 2 || duration != null });
        peakRef.current = Math.max(peakRef.current, snapshotCost(s, snap));
      }
      if (snap) store.set(snap);
      if (done) {
        setRunning(false);
        setFinished({ history: [...st.history], peakCost: peakRef.current });
      }
    }, TICK_S * 1000);
    return () => clearInterval(id);
  }, [running, store]);

  const reset = () => {
    setRunning(false);
    setFinished(null);
    stateRef.current = initialState();
    peakRef.current = 0;
    store.set(null);
  };

  /** Pauses / resumes; a finished challenge run restarts from zero. */
  const toggle = () => {
    if (challenge && finished) {
      reset();
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  };

  return {
    store,
    compiled,
    sim,
    running,
    toggle,
    rps: traffic.rps,
    setRps,
    pattern: traffic.pattern,
    setPattern,
    speed,
    setSpeed,
    reset,
    finished,
    locked: !!challenge,
    duration: challenge?.durationS,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;

export const SimContext = createContext<SimStore | null>(null);

const noop = () => () => {};

export function useSnapshot(): Snapshot | null {
  const store = useContext(SimContext);
  return useSyncExternalStore(store?.subscribe ?? noop, () => store?.get() ?? null, () => null);
}
