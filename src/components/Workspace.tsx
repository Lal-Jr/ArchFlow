"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, Lightbulb, RotateCcw, Trash2, X } from "lucide-react";
import { CATALOG, CATALOG_BY_TYPE, CATEGORY_META, colorFor, type Category, type ComponentType } from "@/lib/catalog";
import type { Problem } from "@/lib/problems";
import { grade } from "@/lib/grader";
import { clearDesign, loadDesign, saveDesign } from "@/lib/storage";
import { nodeTypes, type ArchNodeType } from "./ArchNode";
import { ComponentIcon } from "./ComponentIcon";
import { DifficultyBadge } from "./DifficultyBadge";

const COL_W = 250;
const ROW_H = 120;
const DND_TYPE = "application/archflow";

const edgeDefaults = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#71717a" },
  style: { stroke: "#71717a", strokeWidth: 1.5 },
  labelStyle: { fill: "#d4d4d8", fontSize: 11 },
  labelBgStyle: { fill: "#18181b" },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 4,
};

type Mode = "practice" | "solution";

export function Workspace({ problem }: { problem: Problem }) {
  const [mode, setMode] = useState<Mode>("practice");
  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 px-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft size={16} /> Problems
        </Link>
        <div className="h-5 w-px bg-zinc-800" />
        <h1 className="font-semibold">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
        <div className="ml-auto flex rounded-lg border border-zinc-800 p-0.5 text-sm">
          {(["practice", "solution"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 capitalize transition-colors ${
                mode === m ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m === "practice" ? "Practice" : "Solution walkthrough"}
            </button>
          ))}
        </div>
      </header>
      <ReactFlowProvider key={mode}>
        {mode === "practice" ? <Practice problem={problem} /> : <Walkthrough problem={problem} />}
      </ReactFlowProvider>
    </div>
  );
}

/* ---------------------------------- Practice ---------------------------------- */

function Practice({ problem }: { problem: Problem }) {
  const [saved] = useState(() => loadDesign(problem.slug));
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeType>((saved?.nodes ?? []) as ArchNodeType[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(saved?.edges ?? []);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<"brief" | "feedback">("brief");
  const { screenToFlowPosition } = useReactFlow();
  const idRef = useRef(0);
  const bestRef = useRef(saved?.bestScore ?? 0);

  const result = useMemo(
    () =>
      grade(
        problem.checkpoints,
        nodes.map((n) => ({ id: n.id, type: n.data.kind })),
        edges,
      ),
    [problem.checkpoints, nodes, edges],
  );

  useEffect(() => {
    if (checked) bestRef.current = Math.max(bestRef.current, result.score);
    saveDesign(problem.slug, { nodes, edges, bestScore: bestRef.current });
  }, [checked, result.score, nodes, edges, problem.slug]);

  const addNode = useCallback(
    (kind: ComponentType, position: { x: number; y: number }) => {
      const id = `n${Date.now().toString(36)}${idRef.current++}`;
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id, type: "arch", position, selected: true, data: { kind, label: CATALOG_BY_TYPE[kind].label } },
      ]);
    },
    [setNodes],
  );

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, ...edgeDefaults }, es)),
    [setEdges],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData(DND_TYPE) as ComponentType;
    if (!kind) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(kind, { x: p.x - 88, y: p.y - 26 });
  };

  const addAtCenter = (kind: ComponentType) => {
    const p = screenToFlowPosition({ x: window.innerWidth / 2 + 150, y: window.innerHeight / 2 });
    const base = { x: p.x - 88, y: p.y - 26 };
    const free = (x: number, y: number) =>
      !nodes.some((n) => Math.abs(n.position.x - x) < 190 && Math.abs(n.position.y - y) < 70);
    // Search outward in rings around the viewport center for the first free grid slot.
    for (let ring = 0; ring < 6; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = base.x + dx * 220;
          const y = base.y + dy * 100;
          if (free(x, y)) return addNode(kind, { x, y });
        }
      }
    }
    addNode(kind, base);
  };

  const selected = nodes.find((n) => n.selected);

  const runCheck = () => {
    setChecked(true);
    setTab("feedback");
  };

  const reset = () => {
    if (nodes.length && !window.confirm("Clear your whole diagram?")) return;
    setNodes([]);
    setEdges([]);
    setChecked(false);
    clearDesign(problem.slug);
    bestRef.current = 0;
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Left panel */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-zinc-800">
        <div className="flex border-b border-zinc-800 text-sm">
          {(["brief", "feedback"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 capitalize ${
                tab === t ? "border-b-2 border-violet-400 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "feedback" && checked ? `Feedback · ${result.score}%` : t}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "brief" ? <Brief problem={problem} /> : <Feedback checked={checked} result={result} onCheck={runCheck} />}
        </div>
        <div className="flex gap-2 border-t border-zinc-800 p-3">
          <button
            onClick={runCheck}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500 py-2 text-sm font-medium text-white hover:bg-violet-400"
          >
            <Check size={16} /> Check my design
          </button>
          <button
            onClick={reset}
            title="Clear diagram"
            className="rounded-lg border border-zinc-800 px-3 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </aside>

      {/* Palette */}
      <Palette onAdd={addAtCenter} />

      {/* Canvas */}
      <div className="relative min-w-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={edgeDefaults}
          deleteKeyCode={["Backspace", "Delete"]}
          colorMode="dark"
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#27272a" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => colorFor((n as ArchNodeType).data.kind)} maskColor="#09090bcc" />
        </ReactFlow>
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-sm text-center text-sm text-zinc-500">
              <p className="mb-1 text-base text-zinc-300">Start with the client.</p>
              Drag components from the left onto the canvas, then drag between the dots on their edges to connect them.
              When you think you&apos;re done, hit <span className="text-zinc-300">Check my design</span>.
            </div>
          </div>
        )}
        {selected && (
          <Inspector
            key={selected.id}
            node={selected}
            onRename={(label) =>
              setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, label } } : n)))
            }
            onDelete={() => {
              setNodes((ns) => ns.filter((n) => n.id !== selected.id));
              setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
            }}
          />
        )}
      </div>
    </div>
  );
}

function Palette({ onAdd }: { onAdd: (kind: ComponentType) => void }) {
  const groups = Object.keys(CATEGORY_META) as Category[];
  return (
    <div className="w-[196px] shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
      {groups.map((cat) => (
        <div key={cat} className="mb-4">
          <div className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {CATEGORY_META[cat].label}
          </div>
          {CATALOG.filter((c) => c.category === cat).map((c) => (
            <button
              key={c.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_TYPE, c.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(c.type)}
              title={c.summary}
              className="flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-zinc-300 hover:bg-zinc-900 active:cursor-grabbing"
            >
              <ComponentIcon type={c.type} size={15} color={colorFor(c.type)} />
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Inspector({
  node,
  onRename,
  onDelete,
}: {
  node: ArchNodeType;
  onRename: (label: string) => void;
  onDelete: () => void;
}) {
  const info = CATALOG_BY_TYPE[node.data.kind];
  return (
    <div className="absolute right-4 top-4 z-10 w-72 rounded-xl border border-zinc-800 bg-zinc-900/95 p-4 text-sm shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <ComponentIcon type={info.type} size={16} color={colorFor(info.type)} />
        <span className="font-medium">{info.label}</span>
        <button onClick={onDelete} title="Delete" className="ml-auto text-zinc-500 hover:text-red-400">
          <Trash2 size={15} />
        </button>
      </div>
      <label className="mb-1 block text-xs text-zinc-500">Label</label>
      <input
        defaultValue={node.data.label}
        onChange={(e) => onRename(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100 outline-none focus:border-violet-400"
      />
      <p className="mb-2 text-zinc-400">{info.summary}</p>
      <p className="text-xs text-zinc-500">e.g. {info.examples}</p>
    </div>
  );
}

function Brief({ problem }: { problem: Problem }) {
  return (
    <div className="space-y-5 text-sm">
      <p className="text-zinc-400">{problem.tagline}</p>
      <Section title="Functional requirements" items={problem.functional} />
      <Section title="Non-functional requirements" items={problem.nonFunctional} />
      <Section title="Back-of-envelope" items={problem.estimates} mono />
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
        Interview tip: say the requirements and estimates out loud first. They justify every box you draw.
      </p>
    </div>
  );
}

function Section({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className={`flex gap-2 text-zinc-300 ${mono ? "font-mono text-[12px]" : ""}`}>
            <span className="text-zinc-600">•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feedback({
  checked,
  result,
  onCheck,
}: {
  checked: boolean;
  result: ReturnType<typeof grade>;
  onCheck: () => void;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  if (!checked) {
    return (
      <div className="pt-10 text-center text-sm text-zinc-500">
        <p className="mb-4">Build your design, then check it against the key ideas an interviewer looks for.</p>
        <button onClick={onCheck} className="text-violet-400 hover:text-violet-300">
          Check now →
        </button>
      </div>
    );
  }
  const reveal = (id: string) => setRevealed((s) => new Set(s).add(id));
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-2xl font-semibold">{result.score}%</span>
          <span className="text-zinc-500">
            {result.passed} / {result.total} key ideas
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${result.score}%` }} />
        </div>
        {result.score === 100 && (
          <p className="mt-3 text-emerald-400">
            Nailed it. Compare against the solution walkthrough for the deep-dive talking points.
          </p>
        )}
      </div>
      <p className="text-xs text-zinc-500">Feedback updates live as you edit.</p>
      <ul className="space-y-2">
        {result.results.map(({ checkpoint: cp, passed }) => {
          const open = passed || revealed.has(cp.id);
          return (
            <li
              key={cp.id}
              className={`rounded-lg border p-3 ${passed ? "border-emerald-900/60 bg-emerald-950/20" : "border-zinc-800"}`}
            >
              <div className="flex gap-2">
                {passed ? (
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-400" />
                )}
                <div className="min-w-0">
                  {open ? (
                    <>
                      <div className={passed ? "text-zinc-200" : "text-amber-200"}>{cp.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{cp.why}</p>
                    </>
                  ) : (
                    <>
                      <div className="text-zinc-300">{cp.hint}</div>
                      <button
                        onClick={() => reveal(cp.id)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        <Eye size={12} /> Reveal answer
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------------- Walkthrough --------------------------------- */

/** Connect solution nodes on the sides that face each other. */
function pickHandles(a: { col: number; row: number }, b: { col: number; row: number }) {
  const dx = (b.col - a.col) * COL_W;
  const dy = (b.row - a.row) * ROW_H;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: Position.Right, targetHandle: Position.Left }
      : { sourceHandle: Position.Left, targetHandle: Position.Right };
  }
  return dy >= 0
    ? { sourceHandle: Position.Bottom, targetHandle: Position.Top }
    : { sourceHandle: Position.Top, targetHandle: Position.Bottom };
}

function Walkthrough({ problem }: { problem: Problem }) {
  const steps = problem.solution.nodes;
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const current = steps[step];

  const visible = useMemo(() => {
    const ids = new Set(steps.slice(0, showAll ? steps.length : step + 1).map((n) => n.id));
    return ids;
  }, [steps, step, showAll]);

  const nodes: ArchNodeType[] = steps.map((n) => ({
    id: n.id,
    type: "arch",
    position: { x: n.col * COL_W, y: n.row * ROW_H },
    draggable: false,
    selectable: false,
    data: {
      kind: n.type,
      label: n.label,
      emphasis: !showAll && n.id === current.id ? "current" : visible.has(n.id) ? undefined : "dim",
    },
  }));

  const byId = new Map(steps.map((n) => [n.id, n]));
  const edges: Edge[] = problem.solution.edges
    .filter((e) => visible.has(e.from) && visible.has(e.to))
    .map((e) => {
      const fresh = !showAll && (e.from === current.id || e.to === current.id);
      const color = fresh ? colorFor(current.type) : "#71717a";
      return {
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        ...pickHandles(byId.get(e.from)!, byId.get(e.to)!),
        label: e.label,
        ...edgeDefaults,
        animated: fresh,
        style: { stroke: color, strokeWidth: fresh ? 2 : 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      };
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(steps.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  const info = CATALOG_BY_TYPE[current.type];

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-zinc-800">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm">
          {showAll ? (
            <div className="space-y-2">
              <h2 className="mb-3 text-base font-semibold">Full architecture</h2>
              {steps.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setShowAll(false);
                    setStep(i);
                  }}
                  className="flex w-full gap-2.5 rounded-lg p-2 text-left hover:bg-zinc-900"
                >
                  <ComponentIcon type={n.type} size={15} color={colorFor(n.type)} />
                  <div>
                    <div className="text-zinc-200">{n.label}</div>
                    <div className="text-xs text-zinc-500">{n.note}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 text-xs text-zinc-500">
                Step {step + 1} of {steps.length}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <ComponentIcon type={current.type} size={18} color={colorFor(current.type)} />
                <h2 className="text-lg font-semibold">{current.label}</h2>
              </div>
              <p className="mb-5 leading-relaxed text-zinc-300">{current.note}</p>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">About {info.label}</div>
                <p className="mb-2 text-zinc-400">{info.summary}</p>
                <p className="text-xs text-zinc-500">Tradeoff: {info.tradeoffs[0]}</p>
              </div>
            </>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Deep-dive questions</h3>
            <div className="space-y-2">
              {problem.deepDives.map((d) => (
                <details key={d.q} className="group rounded-lg border border-zinc-800 p-3">
                  <summary className="cursor-pointer list-none text-zinc-200 marker:hidden">
                    <span className="mr-1.5 inline-block text-zinc-500 transition-transform group-open:rotate-90">›</span>
                    {d.q}
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{d.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-zinc-800 p-3">
          <button
            onClick={() => {
              setShowAll(false);
              setStep((s) => Math.max(0, s - 1));
            }}
            disabled={!showAll && step === 0}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-300 hover:border-zinc-700 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              setShowAll(false);
              setStep((s) => Math.min(steps.length - 1, s + 1));
            }}
            disabled={!showAll && step === steps.length - 1}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-500 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-30"
          >
            Next <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
          >
            {showAll ? <X size={16} /> : "Show all"}
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          connectionMode={ConnectionMode.Loose}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#27272a" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
