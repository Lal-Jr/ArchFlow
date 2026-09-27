"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchNodeType, FlowEdgeType } from "@/lib/graph";

interface Frame {
  nodes: ArchNodeType[];
  edges: FlowEdgeType[];
}

const LIMIT = 100;
/** Changes closer together than this collapse into one undo step (e.g. every frame of a drag). */
const SETTLE_MS = 350;

/** What counts as an edit: positions, data and wiring — not selection. */
function keyOf(nodes: ArchNodeType[], edges: FlowEdgeType[]) {
  return JSON.stringify([
    nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data.kind, n.data.label, n.data.config]),
    edges.map((e) => [e.id, e.source, e.target, e.sourceHandle, e.targetHandle, e.data?.ratio, e.data?.label]),
  ]);
}

const strip = ({ nodes, edges }: Frame): Frame => ({
  nodes: nodes.map((n) => ({ ...n, selected: false, dragging: false })),
  edges: edges.map((e) => ({ ...e, selected: false })),
});

/** Undo / redo over the editor's nodes and edges, recording each settled edit as one step. */
export function useHistory(
  nodes: ArchNodeType[],
  edges: FlowEdgeType[],
  restore: (frame: Frame) => void,
) {
  const past = useRef<Frame[]>([]);
  const future = useRef<Frame[]>([]);
  const committed = useRef<{ key: string; frame: Frame }>({ key: keyOf(nodes, edges), frame: strip({ nodes, edges }) });
  const latest = useRef<Frame>({ nodes, edges });
  useEffect(() => {
    latest.current = { nodes, edges };
  });
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const sync = () => setDepth({ past: past.current.length, future: future.current.length });

  useEffect(() => {
    const key = keyOf(nodes, edges);
    if (key === committed.current.key) return;
    const timer = setTimeout(() => {
      past.current = [...past.current, committed.current.frame].slice(-LIMIT);
      future.current = [];
      committed.current = { key, frame: strip({ nodes, edges }) };
      sync();
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  const jump = useCallback(
    (from: React.RefObject<Frame[]>, to: React.RefObject<Frame[]>) => {
      // An edit that hasn't settled yet (e.g. ⌘Z pressed right after it) becomes its own step first.
      const now = latest.current;
      const nowKey = keyOf(now.nodes, now.edges);
      if (nowKey !== committed.current.key) {
        past.current = [...past.current, committed.current.frame].slice(-LIMIT);
        future.current = [];
        committed.current = { key: nowKey, frame: strip(now) };
      }
      const frame = from.current.at(-1);
      if (!frame) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, committed.current.frame];
      committed.current = { key: keyOf(frame.nodes, frame.edges), frame };
      restore(frame);
      sync();
    },
    [restore],
  );

  return {
    undo: useCallback(() => jump(past, future), [jump]),
    redo: useCallback(() => jump(future, past), [jump]),
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
  };
}
