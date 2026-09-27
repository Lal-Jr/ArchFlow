import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CATALOG, CATEGORY_META, type Category } from "@/lib/catalog";
import { ComponentIcon } from "@/components/ComponentIcon";

export const metadata = { title: "Component glossary · ArchFlow" };

export default function LearnPage() {
  const groups = Object.keys(CATEGORY_META) as Category[];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
        <ArrowLeft size={16} /> Back
      </Link>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Component glossary</h1>
      <p className="mb-12 text-zinc-400">
        The building blocks of almost every system design answer: what each one does, when to reach for it, and the
        tradeoffs to mention.
      </p>
      {groups.map((cat) => (
        <section key={cat} className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[cat].color }} />
            {CATEGORY_META[cat].label}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {CATALOG.filter((c) => c.category === cat).map((c) => (
              <article key={c.type} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-2 flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${CATEGORY_META[cat].color}22` }}
                  >
                    <ComponentIcon type={c.type} size={16} color={CATEGORY_META[cat].color} />
                  </span>
                  <div>
                    <h3 className="font-semibold leading-tight">{c.label}</h3>
                    <p className="text-xs text-zinc-500">{c.examples}</p>
                  </div>
                </div>
                <p className="mb-4 text-sm text-zinc-300">{c.summary}</p>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-emerald-400">Use when</div>
                    <ul className="space-y-1 text-zinc-400">
                      {c.whenToUse.map((w) => (
                        <li key={w}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-amber-400">Tradeoffs</div>
                    <ul className="space-y-1 text-zinc-400">
                      {c.tradeoffs.map((t) => (
                        <li key={t}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
