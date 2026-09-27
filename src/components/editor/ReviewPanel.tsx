"use client";

import { useState } from "react";
import { ArrowLeft, CircleCheck, MessageCircleQuestion, OctagonAlert, Sparkles, TriangleAlert, Info } from "lucide-react";
import type { ArchNodeType, FlowEdgeType } from "@/lib/graph";
import { buildReviewRequest, type Review, type ReviewRequest } from "@/lib/review";
import { monthlyCost } from "@/lib/sim/config";
import type { Compiled } from "@/lib/sim/engine";
import { deriveInsights } from "@/lib/sim/insights";
import { useSnapshot } from "./useSimulation";

type State = { status: "idle" } | { status: "loading" } | { status: "done"; review: Review } | { status: "error"; message: string };

const SEVERITY = {
  high: { Icon: OctagonAlert, cls: "text-bad", label: "High" },
  medium: { Icon: TriangleAlert, cls: "text-warn-ink", label: "Medium" },
  low: { Icon: Info, cls: "text-ink-2", label: "Low" },
};

export function ReviewPanel({
  nodes,
  edges,
  compiled,
  context,
  onBack,
}: {
  nodes: ArchNodeType[];
  edges: FlowEdgeType[];
  compiled: Compiled;
  context: ReviewRequest["context"];
  onBack: () => void;
}) {
  const snap = useSnapshot();
  const [state, setState] = useState<State>({ status: "idle" });

  const run = async () => {
    setState({ status: "loading" });
    const cost = monthlyCost(
      [...compiled.nodes.values()],
      snap ? Object.fromEntries(Object.entries(snap.nodes).map(([id, m]) => [id, m.replicas])) : undefined,
    );
    const body = buildReviewRequest(nodes, edges, context, snap, snap ? deriveInsights(compiled, snap) : [], cost);
    try {
      const res = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setState({ status: "error", message: data.message ?? "The review failed. Try again." });
      else setState({ status: "done", review: data.review });
    } catch {
      setState({ status: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  };

  return (
    <div className="p-5 text-sm">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink">
        <ArrowLeft size={14} /> Live insights
      </button>
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Sparkles size={18} /> AI design review
      </h2>
      <p className="mb-4 text-ink-3">
        Claude reviews your design like an interviewer would{snap ? ", using the simulation results so far" : ""}.
        {!snap && " Run traffic first for a sharper review."}
      </p>

      {state.status !== "loading" && (
        <button
          onClick={run}
          disabled={nodes.length === 0}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 font-semibold text-white hover:bg-ink-2 disabled:opacity-40"
        >
          <Sparkles size={15} /> {state.status === "done" ? "Review again" : "Review my design"}
        </button>
      )}

      {state.status === "loading" && (
        <div className="mb-5 space-y-2 rounded-xl bg-wash p-4" role="status">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-ink" />
          </div>
          <p className="text-xs text-ink-2">Reading the design and the simulator&apos;s numbers. This usually takes 20–40 seconds.</p>
        </div>
      )}

      {state.status === "error" && <p className="rounded-xl bg-bad-wash p-3 text-bad">{state.message}</p>}

      {state.status === "done" && <ReviewResult review={state.review} />}
    </div>
  );
}

function ReviewResult({ review }: { review: Review }) {
  const score = Math.max(1, Math.min(10, review.score));
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{score}</span>
          <span className="text-ink-3">/ 10</span>
        </div>
        <div className="mb-3 flex gap-0.5" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? (score >= 7 ? "bg-good" : score >= 4 ? "bg-warn" : "bg-bad") : "bg-line"}`} />
          ))}
        </div>
        <p className="leading-relaxed">{review.verdict}</p>
      </div>

      {review.risks.length > 0 && (
        <Section title="Risks">
          {review.risks.map((r, i) => {
            const s = SEVERITY[r.severity];
            return (
              <li key={i} className="flex gap-2.5 py-3">
                <s.Icon size={16} className={`mt-0.5 shrink-0 ${s.cls}`} aria-label={`${s.label} severity`} />
                <div>
                  <div className="font-semibold leading-snug">{r.title}</div>
                  <div className="text-[11px] text-ink-3">{r.component}</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">{r.detail}</p>
                </div>
              </li>
            );
          })}
        </Section>
      )}

      {review.strengths.length > 0 && (
        <Section title="What's working">
          {review.strengths.map((s, i) => (
            <li key={i} className="flex gap-2.5 py-3">
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-good" aria-label="Strength" />
              <div>
                <div className="font-semibold leading-snug">{s.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.detail}</p>
              </div>
            </li>
          ))}
        </Section>
      )}

      {review.nextSteps.length > 0 && (
        <Section title="Try next">
          {review.nextSteps.map((s, i) => (
            <li key={i} className="flex gap-2.5 py-2.5 text-xs leading-relaxed text-ink-2">
              <span className="font-mono text-ink-3">{i + 1}</span>
              {s}
            </li>
          ))}
        </Section>
      )}

      {review.interviewerQuestions.length > 0 && (
        <Section title="An interviewer might ask">
          {review.interviewerQuestions.map((q, i) => (
            <li key={i} className="flex gap-2.5 py-2.5 text-xs leading-relaxed">
              <MessageCircleQuestion size={14} className="mt-0.5 shrink-0 text-ink-3" />
              {q}
            </li>
          ))}
        </Section>
      )}
      <p className="text-[11px] text-ink-4">AI feedback can be wrong. Check it against the simulator.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider">{title}</h3>
      <ul className="divide-y divide-line border-y border-line">{children}</ul>
    </div>
  );
}
