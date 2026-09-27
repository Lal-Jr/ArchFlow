"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useMemo } from "react";
import { Background, BackgroundVariant, ConnectionMode, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { ArrowRight, Check, ChevronRight, CircleAlert, Lightbulb, Play } from "lucide-react";
import { CATALOG_BY_TYPE } from "@/lib/catalog";
import { solutionToGraph } from "@/lib/graph";
import type { Problem } from "@/lib/problems";
import { ComponentIcon } from "./ComponentIcon";
import { DifficultyBadge } from "./DifficultyBadge";
import { nodeTypes } from "./editor/ArchNode";
import { defaultEdgeOptions } from "./editor/Editor";
import { edgeTypes } from "./editor/FlowEdge";

const SECTIONS = [
  ["requirements", "Requirements"],
  ["estimates", "Estimates"],
  ["api", "API design"],
  ["data", "Data model"],
  ["design", "High-level design"],
  ["decisions", "Key decisions: why"],
  ["deep-dives", "Follow-up questions"],
  ["mistakes", "Common mistakes"],
  ["rubric", "What's graded"],
] as const;

const METHOD: Record<string, string> = {
  GET: "bg-good-wash text-good",
  POST: "bg-accent/10 text-accent",
  PUT: "bg-warn-wash text-warn-ink",
  PATCH: "bg-warn-wash text-warn-ink",
  DELETE: "bg-bad-wash text-bad",
  WS: "bg-ink text-white",
};

function Section({ id, n, title, intro, children }: { id: string; n: number; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-10">
      <div className="mb-1 font-mono text-sm text-ink-3">{String(n).padStart(2, "0")}</div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight">{title}</h2>
      {intro && <p className="mb-6 max-w-2xl text-ink-2">{intro}</p>}
      {children}
    </section>
  );
}

export function ProblemGuide({ problem, onPractice, onWalkthrough }: { problem: Problem; onPractice: () => void; onWalkthrough: () => void }) {
  const graph = useMemo(() => solutionToGraph(problem), [problem]);
  const nodes = graph.nodes.map((n) => ({ ...n, draggable: false, selectable: false }));
  const edges = graph.edges.map((e) => ({ ...e, ...defaultEdgeOptions, selectable: false }));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Guide sections">
          <div className="sticky top-6 space-y-0.5 text-sm">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">On this page</div>
            {SECTIONS.map(([id, label], i) => (
              <a key={id} href={`#${id}`} className="flex gap-2 rounded-md px-2 py-1.5 text-ink-2 hover:bg-wash hover:text-ink">
                <span className="font-mono text-xs text-ink-4">{i + 1}</span>
                {label}
              </a>
            ))}
            <div className="space-y-2 pt-4">
              <button onClick={onPractice} className="w-full rounded-lg bg-ink py-2 text-sm font-semibold text-white hover:bg-ink-2">
                Practice it
              </button>
              <button onClick={onWalkthrough} className="w-full rounded-lg bg-wash py-2 text-sm font-semibold hover:bg-line">
                Walk through it
              </button>
            </div>
          </div>
        </nav>

        <article className="min-w-0 space-y-12">
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <DifficultyBadge difficulty={problem.difficulty} />
              <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">{problem.category}</span>
              {problem.askedAt.length > 0 && <span className="text-sm text-ink-3">Reported at {problem.askedAt.join(", ")}</span>}
            </div>
            <h1 className="mb-2 text-4xl font-bold tracking-tighter sm:text-5xl">{problem.title}</h1>
            <p className="mb-5 text-lg text-ink-2">{problem.tagline}</p>
            <div className="rounded-2xl bg-wash p-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">What this question tests</div>
              <div className="flex flex-wrap gap-2">
                {problem.concepts.map((c) => (
                  <span key={c} className="rounded-full bg-white px-3 py-1 text-sm font-medium shadow-sm">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <Section id="requirements" n={1} title="Requirements" intro="Pin these down in the first few minutes. Every later choice should trace back to one of them.">
            <div className="grid gap-6 md:grid-cols-2">
              {[
                ["Functional — what it does", problem.functional],
                ["Non-functional — how well", problem.nonFunctional],
              ].map(([title, items]) => (
                <div key={title as string}>
                  <h3 className="mb-2 text-sm font-bold">{title as string}</h3>
                  <ul className="space-y-2">
                    {(items as string[]).map((it) => (
                      <li key={it} className="flex gap-2 text-ink-2">
                        <Check size={16} className="mt-1 shrink-0 text-ink-3" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="estimates" n={2} title="Back-of-the-envelope estimates" intro="Rough numbers decide the architecture: whether data fits in memory, whether you need sharding, where the load is.">
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {problem.estimates.map((e) => (
                <li key={e} className="px-5 py-3 font-mono text-sm">
                  {e}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="api" n={3} title="API design" intro="Define the contract before the boxes. It shows the interviewer exactly what the system must support.">
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-wash text-xs uppercase tracking-wider text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Method</th>
                    <th className="px-4 py-2.5 font-semibold">Endpoint</th>
                    <th className="px-4 py-2.5 font-semibold">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {problem.api.map((a) => (
                    <tr key={a.method + a.path}>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold ${METHOD[a.method]}`}>{a.method}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.path}</td>
                      <td className="px-4 py-3 text-ink-2">{a.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="data" n={4} title="Data model" intro="Pick each store by its access pattern, and be ready to say why.">
            <div className="grid gap-4 md:grid-cols-2">
              {problem.dataModel.map((d) => (
                <div key={d.entity} className="rounded-2xl border border-line p-5">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold">{d.entity}</h3>
                    <span className="rounded-md bg-wash px-2 py-0.5 text-xs font-semibold">{d.store}</span>
                  </div>
                  <p className="mb-3 font-mono text-xs text-ink-3">{d.fields}</p>
                  <p className="text-sm text-ink-2">
                    <span className="font-semibold text-ink">Why: </span>
                    {d.why}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="design" n={5} title="High-level design" intro="The reference architecture. Every component is here for a reason, listed below.">
            <div className="mb-4 h-[420px] overflow-hidden rounded-2xl border border-line bg-canvas">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  nodesConnectable={false}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                  fitViewOptions={{ padding: 0.12, maxZoom: 0.9 }}
                  zoomOnScroll={false}
                  preventScrolling={false}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background variant={BackgroundVariant.Lines} gap={48} color="#e4e4e4" />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
            <div className="mb-6 flex flex-wrap gap-2">
              <Link
                href={`/sandbox?template=${problem.slug}`}
                className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-2"
              >
                <Play size={14} fill="#fff" /> Load-test this design
              </Link>
              <button onClick={onWalkthrough} className="flex items-center gap-2 rounded-lg bg-wash px-4 py-2.5 text-sm font-semibold hover:bg-line">
                Step through it <ArrowRight size={14} />
              </button>
            </div>
            <ol className="divide-y divide-line border-y border-line">
              {problem.solution.nodes.map((n) => (
                <li key={n.id} className="flex gap-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink">
                    <ComponentIcon type={n.type} size={15} color="#fff" />
                  </span>
                  <span>
                    <span className="block font-semibold">
                      {n.label} <span className="text-xs font-normal text-ink-3">· {CATALOG_BY_TYPE[n.type].label}</span>
                    </span>
                    <span className="block text-sm text-ink-2">{n.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="decisions" n={6} title="Key decisions: why" intro="Interviewers care less about the boxes than about the reasoning. These are the tradeoffs to be able to explain.">
            <div className="space-y-3">
              {problem.decisions.map((d) => (
                <div key={d.q} className="rounded-2xl border border-line p-5">
                  <h3 className="mb-2 font-bold">{d.q}</h3>
                  <p className="leading-relaxed text-ink-2">{d.a}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="deep-dives" n={7} title="Follow-up questions" intro="Once the basic design is up, expect the interviewer to push on these. Try answering before you open each one.">
            <div className="divide-y divide-line border-y border-line">
              {problem.deepDives.map((d) => (
                <details key={d.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold marker:hidden">
                    {d.q}
                    <ChevronRight size={16} className="text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 leading-relaxed text-ink-2">{d.a}</p>
                </details>
              ))}
            </div>
          </Section>

          <Section id="mistakes" n={8} title="Common mistakes" intro="Candidates lose points on these more than anything else.">
            <ul className="space-y-2">
              {problem.mistakes.map((m) => (
                <li key={m} className="flex gap-3 rounded-xl bg-bad-wash p-4 text-ink">
                  <CircleAlert size={18} className="mt-0.5 shrink-0 text-bad" aria-label="Mistake" />
                  {m}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="rubric" n={9} title="What's graded" intro="These are the key ideas Practice mode checks your diagram for, with the reasoning behind each.">
            <ul className="divide-y divide-line border-y border-line">
              {problem.checkpoints.map((c) => (
                <li key={c.id} className="flex gap-3 py-3">
                  <Lightbulb size={16} className="mt-1 shrink-0 text-warn-ink" />
                  <span>
                    <span className="block font-semibold">{c.title}</span>
                    <span className="block text-sm text-ink-2">{c.why}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button onClick={onPractice} className="mt-6 flex items-center gap-2 rounded-lg bg-ink px-5 py-3 font-semibold text-white hover:bg-ink-2">
              Now design it yourself <ArrowRight size={16} />
            </button>
          </Section>
        </article>
      </div>
    </div>
  );
}
