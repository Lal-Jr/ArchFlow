"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Link2, X } from "lucide-react";
import { gridGraph, solutionToGraph } from "@/lib/graph";
import { PROBLEMS } from "@/lib/problems";
import { decodeDesign, encodeDesign, SHARE_PARAM } from "@/lib/share";
import { clearDesign, loadDesign, saveDesign } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";
import { NavLink, TopBar } from "./TopBar";
import { Editor, type Graph } from "./editor/Editor";

const KEY = "sandbox";
const BACKUP_KEY = "sandbox-before-shared";

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

  // A #d= link holds a whole shared design. Back up the visitor's own sandbox before loading it.
  const [shared, setShared] = useState<"loaded" | "invalid" | null>(null);
  useEffect(() => {
    const open = () => {
      const code = new URLSearchParams(window.location.hash.slice(1)).get(SHARE_PARAM);
      if (!code) return;
      window.history.replaceState(null, "", "/sandbox");
      decodeDesign(code)
        .then((g) => {
          const mine = loadDesign(KEY);
          if (mine?.nodes.length) saveDesign(BACKUP_KEY, mine);
          saveDesign(KEY, g);
          setShared("loaded");
          setVersion((v) => v + 1);
        })
        .catch(() => setShared("invalid"));
    };
    open();
    // Pasting a link into an already-open sandbox only changes the hash — no reload.
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const share = async () => {
    const design = loadDesign(KEY);
    if (!design) return;
    const url = `${window.location.origin}/sandbox#${SHARE_PARAM}=${await encodeDesign(design)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("copied");
    } catch {
      window.prompt("Copy this link to share your design:", url);
      setCopied(null);
      return;
    }
    setTimeout(() => setCopied(null), 2500);
  };

  const restoreMine = () => {
    const mine = loadDesign(BACKUP_KEY);
    if (mine) saveDesign(KEY, mine);
    clearDesign(BACKUP_KEY);
    setShared(null);
    setVersion((v) => v + 1);
  };

  const load = (id: string, g: Graph) => {
    if (g.nodes.length && !window.confirm("Replace the current design?")) return;
    if (applyTemplate(id)) setVersion((v) => v + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar
        right={
          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-ink hover:bg-white/90"
          >
            {copied === "copied" ? <Check size={14} /> : <Link2 size={14} />}
            {copied === "copied" ? "Link copied" : "Share design"}
          </button>
        }
      >
        <nav className="flex gap-1">
          <NavLink href="/sandbox" active>
            Simulator
          </NavLink>
          <NavLink href="/challenges">Challenges</NavLink>
          <NavLink href="/#problems">Practice</NavLink>
          <NavLink href="/learn">Glossary</NavLink>
        </nav>
      </TopBar>
      {shared && (
        <div className={`flex items-center gap-3 px-5 py-2 text-sm ${shared === "loaded" ? "bg-accent text-white" : "bg-bad text-white"}`}>
          <span className="flex-1">
            {shared === "loaded"
              ? "You're viewing a shared design. Your own sandbox was saved."
              : "That share link is broken or incomplete, so your sandbox is unchanged."}
          </span>
          {shared === "loaded" && loadDesign(BACKUP_KEY) && (
            <button onClick={restoreMine} className="rounded-full bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
              Restore my design
            </button>
          )}
          <button onClick={() => setShared(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-white/20">
            <X size={14} />
          </button>
        </div>
      )}
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
