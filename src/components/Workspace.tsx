"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Lightbulb, Play, RotateCcw, X } from "lucide-react";
import { CATALOG_BY_TYPE } from "@/lib/catalog";
import { solutionToGraph, type ArchNodeType, type FlowEdgeType } from "@/lib/graph";
import type { Problem } from "@/lib/problems";
import { grade } from "@/lib/grader";
import { clearDesign, loadBest, saveBest } from "@/lib/storage";
import { ComponentIcon } from "./ComponentIcon";
import { DifficultyBadge } from "./DifficultyBadge";
import { TopBar } from "./TopBar";
import { nodeTypes } from "./editor/ArchNode";
import { defaultEdgeOptions, Editor, type Graph } from "./editor/Editor";
import { edgeTypes } from "./editor/FlowEdge";

type Mode = "practice" | "solution";

export function Workspace({ problem }: { problem: Problem }) {
  const [mode, setMode] = useState<Mode>("practice");
  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar
        right={
          <>
            <div className="flex rounded-full bg-white/10 p-1">
              {(["practice", "solution"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3.5 py-1 text-sm font-medium ${
                    mode === m ? "bg-white text-ink" : "text-white/70 hover:text-white"
                  }`}
                >
                  {m === "practice" ? "Practice" : "Walkthrough"}
                </button>
              ))}
            </div>
            <Link
              href={`/sandbox?template=${problem.slug}`}
              className="ml-2 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-white/90"
            >
              <Play size={13} fill="#000" /> Simulate reference
            </Link>
          </>
        }
      >
        <Link href="/#problems" className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft size={15} /> Problems
        </Link>
        <span className="text-white/30">/</span>
        <h1 className="font-semibold">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} invert />
      </TopBar>
      {mode === "practice" ? <Practice problem={problem} /> : <Walkthrough problem={problem} />}
    </div>
  );
}

/* ---------------------------------- Practice ---------------------------------- */

function Practice({ problem }: { problem: Problem }) {
  const [checked, setChecked] = useState(false);
  const [version, setVersion] = useState(0);
  const [best, setBest] = useState(() => loadBest(problem.slug));

  const scoreOf = (g: Graph) =>
    grade(
      problem.checkpoints,
      g.nodes.map((n) => ({ id: n.id, type: n.data.kind })),
      g.edges,
    );

  const check = (g: Graph) => {
    setChecked(true);
    const { score } = scoreOf(g);
    if (score > best) {
      setBest(score);
      saveBest(problem.slug, score);
    }
  };

  const reset = (g: Graph) => {
    if (g.nodes.length && !window.confirm("Clear your whole diagram?")) return;
    clearDesign(problem.slug);
    setChecked(false);
    setVersion((v) => v + 1);
  };

  return (
    <Editor
      key={version}
      storageKey={problem.slug}
      tabs={(g) => [
        { id: "brief", label: "Brief", content: <Brief problem={problem} /> },
        {
          id: "feedback",
          label: checked ? `Score ${scoreOf(g).score}%` : "Feedback",
          content: <Feedback checked={checked} result={scoreOf(g)} best={best} onCheck={() => check(g)} />,
        },
      ]}
      footer={(g) => (
        <div className="flex gap-2">
          <button
            onClick={() => check(g)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-sm font-semibold text-white hover:bg-ink-2"
          >
            <Check size={16} /> Check my design
          </button>
          <button
            onClick={() => reset(g)}
            title="Clear diagram"
            className="rounded-lg bg-wash px-3 text-ink-2 hover:bg-line hover:text-ink"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    />
  );
}

function Brief({ problem }: { problem: Problem }) {
  return (
    <div className="space-y-6 p-5 text-sm">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{problem.title}</h2>
        <p className="text-ink-3">{problem.tagline}</p>
      </div>
      <Section title="Functional" items={problem.functional} />
      <Section title="Non-functional" items={problem.nonFunctional} />
      <Section title="Back of the envelope" items={problem.estimates} />
      <div className="rounded-xl bg-ink p-4 text-xs leading-relaxed text-white">
        <div className="mb-1 font-semibold">Interview tip</div>
        <span className="text-white/75">
          Say the requirements and estimates out loud first. They justify every box you draw. Then run traffic at the
          estimated rate and check that your design holds.
        </span>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider">{title}</h3>
      <ul className="divide-y divide-line border-y border-line">
        {items.map((it) => (
          <li key={it} className="py-2 text-ink-2">
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
  best,
  onCheck,
}: {
  checked: boolean;
  result: ReturnType<typeof grade>;
  best: number;
  onCheck: () => void;
}) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  if (!checked) {
    return (
      <div className="p-5 pt-10 text-center text-sm text-ink-2">
        <p className="mb-4">Build your design, then check it against the key ideas an interviewer looks for.</p>
        <button onClick={onCheck} className="font-semibold underline">
          Check now
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-5 text-sm">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-5xl font-bold tracking-tight">{result.score}%</span>
          <span className="text-ink-3">
            {result.passed} of {result.total} key ideas
          </span>
        </div>
        <div className="mt-3 flex gap-1">
          {result.results.map((r) => (
            <div key={r.checkpoint.id} className={`h-1.5 flex-1 rounded-full ${r.passed ? "bg-good" : "bg-line"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Updates live as you edit · best {best}%</p>
        {result.score === 100 && (
          <p className="mt-3 rounded-lg bg-good-wash p-3 text-good">
            All key ideas covered. Now run traffic and see if it survives the Ramp pattern.
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {result.results.map(({ checkpoint: cp, passed }) => {
          const open = passed || revealed.has(cp.id);
          return (
            <li key={cp.id} className="rounded-xl border border-line p-3">
              <div className="flex gap-2.5">
                {passed ? (
                  <Check size={16} className="mt-0.5 shrink-0 text-good" aria-label="Passed" />
                ) : (
                  <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn-ink" aria-label="Hint" />
                )}
                <div className="min-w-0">
                  {open ? (
                    <>
                      <div className="font-semibold">{cp.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-2">{cp.why}</p>
                    </>
                  ) : (
                    <>
                      <div>{cp.hint}</div>
                      <button
                        onClick={() => setRevealed((s) => new Set(s).add(cp.id))}
                        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
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

function Walkthrough({ problem }: { problem: Problem }) {
  const steps = problem.solution.nodes;
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const current = steps[step];
  const base = useMemo(() => solutionToGraph(problem), [problem]);
  const visible = new Set(steps.slice(0, showAll ? steps.length : step + 1).map((n) => n.id));

  const nodes: ArchNodeType[] = base.nodes.map((n) => ({
    ...n,
    draggable: false,
    selectable: false,
    data: {
      ...n.data,
      emphasis: !showAll && n.id === current.id ? "current" : visible.has(n.id) ? undefined : "dim",
    },
  }));
  const edges: FlowEdgeType[] = base.edges
    .filter((e) => visible.has(e.source) && visible.has(e.target))
    .map((e) => ({
      ...e,
      ...defaultEdgeOptions,
      selectable: false,
      data: { ...e.data, highlight: !showAll && (e.source === current.id || e.target === current.id) },
    }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(steps.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  const info = CATALOG_BY_TYPE[current.type];
  const go = (d: number) => {
    setShowAll(false);
    setStep((s) => Math.max(0, Math.min(steps.length - 1, s + d)));
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-line">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm">
          {showAll ? (
            <>
              <h2 className="mb-4 text-xl font-bold tracking-tight">Full architecture</h2>
              <ol className="divide-y divide-line border-y border-line">
                {steps.map((n, i) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setShowAll(false);
                        setStep(i);
                      }}
                      className="flex w-full gap-3 py-3 text-left hover:bg-wash"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink">
                        <ComponentIcon type={n.type} size={14} color="#fff" />
                      </span>
                      <span>
                        <span className="block font-semibold">{n.label}</span>
                        <span className="block text-xs text-ink-2">{n.note}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <div className="mb-4 flex gap-1">
                {steps.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setStep(i)}
                    aria-label={`Step ${i + 1}`}
                    className={`h-1 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-line"}`}
                  />
                ))}
              </div>
              <div className="mb-1 text-xs font-medium text-ink-3">
                Step {step + 1} of {steps.length}
              </div>
              <h2 className="mb-3 text-2xl font-bold tracking-tight">{current.label}</h2>
              <p className="mb-5 text-base leading-relaxed text-ink-2">{current.note}</p>
              <div className="rounded-xl bg-wash p-4">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider">{info.label}</div>
                <p className="mb-2 text-ink-2">{info.summary}</p>
                <p className="text-xs text-ink-3">Tradeoff: {info.tradeoffs[0]}</p>
              </div>
            </>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider">Deep-dive questions</h3>
            <div className="divide-y divide-line border-y border-line">
              {problem.deepDives.map((d) => (
                <details key={d.q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold marker:hidden">
                    {d.q}
                    <ChevronRight size={16} className="text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-ink-2">{d.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-line p-3">
          <button
            onClick={() => go(-1)}
            disabled={!showAll && step === 0}
            className="rounded-lg bg-wash p-2.5 hover:bg-line disabled:opacity-30"
            aria-label="Previous step"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => go(1)}
            disabled={!showAll && step === steps.length - 1}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-white hover:bg-ink-2 disabled:opacity-30"
          >
            Next <ArrowRight size={15} />
          </button>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="rounded-lg bg-wash px-3 py-2.5 text-sm font-medium hover:bg-line"
          >
            {showAll ? <X size={16} /> : "Show all"}
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 bg-canvas">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesConnectable={false}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Lines} gap={48} color="#e4e4e4" />
            <Controls position="top-left" showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
