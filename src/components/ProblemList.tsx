"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { CATEGORIES, COMPANIES, PROBLEMS, type Difficulty, type ProblemCategory } from "@/lib/problems";
import { loadBest } from "@/lib/storage";
import { DifficultyBadge } from "./DifficultyBadge";

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-ink text-white" : "bg-wash text-ink-2 hover:bg-line hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function ProblemList() {
  // Serialized so the snapshot compares by value between renders.
  const snapshot = useSyncExternalStore(
    () => () => {},
    () => JSON.stringify(Object.fromEntries(PROBLEMS.map((p) => [p.slug, loadBest(p.slug)]))),
    () => "{}",
  );
  const scores = JSON.parse(snapshot) as Record<string, number>;

  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [category, setCategory] = useState<ProblemCategory | null>(null);
  const [company, setCompany] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  // Easiest first, so the list doubles as a learning path.
  const shown = [...PROBLEMS].sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty)).filter(
    (p) =>
      (!difficulty || p.difficulty === difficulty) &&
      (!category || p.category === category) &&
      (!company || p.askedAt.includes(company)) &&
      (!q || [p.title, p.tagline, p.category, ...p.concepts, ...p.askedAt].some((t) => t.toLowerCase().includes(q))),
  );
  const filtered = !!(q || difficulty || category || company);
  const mastered = PROBLEMS.filter((p) => scores[p.slug] === 100).length;

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems or concepts, e.g. caching, WebSockets, geohash"
              aria-label="Search problems"
              className="w-full rounded-xl bg-wash py-3 pl-10 pr-4 outline-none ring-1 ring-transparent placeholder:text-ink-4 focus:bg-white focus:ring-ink"
            />
          </div>
          <span className="text-sm text-ink-3">
            {mastered > 0 && `${mastered} mastered · `}
            {shown.length} of {PROBLEMS.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DIFFICULTIES.map((d) => (
            <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(difficulty === d ? null : d)}>
              {d}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {CATEGORIES.map((c) => (
            <Chip key={c} on={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-3">Reported at</span>
          {COMPANIES.map((c) => (
            <Chip key={c} on={company === c} onClick={() => setCompany(company === c ? null : c)}>
              {c}
            </Chip>
          ))}
          {filtered && (
            <button
              onClick={() => {
                setQuery("");
                setDifficulty(null);
                setCategory(null);
                setCompany(null);
              }}
              className="ml-1 flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-ink-3">No problems match those filters.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((p) => {
            const score = scores[p.slug] ?? 0;
            return (
              <li key={p.slug}>
                <Link
                  href={`/problems/${p.slug}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-[1fr_150px_auto]"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-lg font-bold tracking-tight group-hover:underline">{p.title}</span>
                      <span className="text-sm text-ink-3">{p.tagline}</span>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">{p.category}</span>
                      {p.concepts.slice(0, 4).map((c) => (
                        <span key={c} className="rounded-md bg-wash px-2 py-0.5 text-[11px] font-medium text-ink-2">
                          {c}
                        </span>
                      ))}
                    </span>
                    {p.askedAt.length > 0 && (
                      <span className="mt-1.5 block text-xs text-ink-3">Reported at {p.askedAt.join(", ")}</span>
                    )}
                  </span>
                  <span className="hidden sm:block">
                    <DifficultyBadge difficulty={p.difficulty} />
                    {score > 0 && (
                      <span className={`mt-1 block text-xs font-medium ${score === 100 ? "text-good" : "text-ink-3"}`}>
                        {score === 100 ? "✓ Mastered" : `Best ${score}%`}
                      </span>
                    )}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-wash transition-colors group-hover:bg-ink group-hover:text-white">
                    <ArrowRight size={18} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
