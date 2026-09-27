"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { gridGraph, solutionToGraph } from "@/lib/graph";
import { PROBLEMS } from "@/lib/problems";
import { saveDesign } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";
import { NavLink, TopBar } from "./TopBar";
import { Editor, type Graph } from "./editor/Editor";

const KEY = "sandbox";

const TEMPLATES: { id: string; title: string; blurb: string; graph: () => Graph }[] = [
  {
    id: "three-tier",
    title: "Three-tier web app",
    blurb: "Load balancer, app servers, cache and database — the classic starting point.",
    graph: () =>
      gridGraph(
        [
          ["c", "client", "Users", 0, 1],
          ["lb", "load_balancer", "Load Balancer", 1, 1],
          ["api", "service", "API Servers", 2, 1],
          ["redis", "cache", "Redis", 3, 0],
          ["db", "sql_db", "Postgres", 3, 2],
        ],
        [["c", "lb"], ["lb", "api"], ["api", "redis"], ["api", "db"]],
      ),
  },
  {
    id: "async-jobs",
    title: "Async job pipeline",
    blurb: "An API that offloads slow work to a queue and workers. Watch the backlog under spikes.",
    graph: () =>
      gridGraph(
        [
          ["c", "client", "Users", 0, 1],
          ["lb", "load_balancer", "Load Balancer", 1, 1],
          ["api", "service", "API", 2, 1],
          ["q", "queue", "Job Queue", 3, 1],
          ["w", "worker", "Workers", 4, 1],
          ["db", "nosql_db", "Results Store", 5, 1],
        ],
        [["c", "lb"], ["lb", "api"], ["api", "q"], ["q", "w"], ["w", "db"]],
      ),
  },
  {
    id: "blank",
    title: "Blank canvas",
    blurb: "Start from nothing.",
    graph: () => ({ nodes: [], edges: [] }),
  },
];

function applyTemplate(id: string): boolean {
  const t = TEMPLATES.find((t) => t.id === id);
  const p = PROBLEMS.find((p) => p.slug === id);
  const graph = t ? t.graph() : p ? solutionToGraph(p) : null;
  if (!graph) return false;
  saveDesign(KEY, graph);
  return true;
}

export function Sandbox() {
  // A ?template= link (from "Simulate reference") replaces the sandbox contents once.
  // Applied before the editor first reads storage, so the template is what it loads.
  const [fromLink] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("template");
    return !!id && applyTemplate(id);
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    // Drop the query so a reload doesn't wipe edits made since.
    if (fromLink) window.history.replaceState(null, "", "/sandbox");
  }, [fromLink]);

  const load = (id: string, g: Graph) => {
    if (g.nodes.length && !window.confirm("Replace the current design?")) return;
    if (applyTemplate(id)) setVersion((v) => v + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar>
        <nav className="flex gap-1">
          <NavLink href="/sandbox" active>
            Simulator
          </NavLink>
          <NavLink href="/challenges">Challenges</NavLink>
          <NavLink href="/#problems">Practice</NavLink>
          <NavLink href="/learn">Glossary</NavLink>
        </nav>
      </TopBar>
      <Editor
        key={version}
        storageKey={KEY}
        initial={TEMPLATES[0].graph()}
        tabs={(g) => [
          {
            id: "templates",
            label: "Templates",
            content: (
              <div className="p-3">
                <p className="mb-3 px-2 text-xs text-ink-3">Load a starting point. This replaces the canvas.</p>
                <TemplateGroup title="Starters">
                  {TEMPLATES.map((t) => (
                    <TemplateRow key={t.id} title={t.title} blurb={t.blurb} onClick={() => load(t.id, g)} />
                  ))}
                </TemplateGroup>
                <TemplateGroup title="Interview reference designs">
                  {PROBLEMS.map((p) => (
                    <TemplateRow
                      key={p.slug}
                      title={p.title}
                      blurb={p.tagline}
                      meta={<DifficultyBadge difficulty={p.difficulty} />}
                      onClick={() => load(p.slug, g)}
                    />
                  ))}
                </TemplateGroup>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function TemplateGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider">{title}</div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function TemplateRow({ title, blurb, meta, onClick }: { title: string; blurb: string; meta?: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-wash">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block text-xs text-ink-3">{blurb}</span>
        {meta && <span className="mt-1 block">{meta}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-3" />
    </button>
  );
}
