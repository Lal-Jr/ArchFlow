import { CATALOG, CATEGORY_META, type Category } from "@/lib/catalog";
import { DEFAULTS, ROLE, ROLE_BEHAVIOR } from "@/lib/sim/config";
import { fmtRps } from "@/lib/sim/format";
import { ComponentIcon } from "@/components/ComponentIcon";
import { NavLink, TopBar } from "@/components/TopBar";

export const metadata = { title: "Component glossary · ArchFlow" };

export default function LearnPage() {
  const groups = Object.keys(CATEGORY_META) as Category[];
  return (
    <div className="flex-1">
      <TopBar>
        <nav className="flex gap-1">
          <NavLink href="/sandbox">Simulator</NavLink>
          <NavLink href="/challenges">Challenges</NavLink>
          <NavLink href="/#problems">Practice</NavLink>
          <NavLink href="/learn" active>
            Glossary
          </NavLink>
        </nav>
      </TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h1 className="mb-3 text-5xl font-bold tracking-tighter">Component glossary</h1>
        <p className="mb-14 max-w-2xl text-lg text-ink-2">
          The building blocks of almost every system design answer: what each one does, when to reach for it, the tradeoffs
          to mention, and how the simulator models it.
        </p>
        {groups.map((cat) => (
          <section key={cat} className="mb-14">
            <h2 className="mb-2 border-b-2 border-ink pb-3 text-sm font-bold uppercase tracking-wider">
              {CATEGORY_META[cat].label}
            </h2>
            <div className="divide-y divide-line">
              {CATALOG.filter((c) => c.category === cat).map((c) => {
                const d = DEFAULTS[c.type];
                const role = ROLE[c.type];
                return (
                  <article key={c.type} className="grid gap-6 py-8 md:grid-cols-[260px_1fr]">
                    <div className="flex gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink">
                        <ComponentIcon type={c.type} size={20} color="#fff" />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold leading-tight tracking-tight">{c.label}</h3>
                        <p className="text-xs text-ink-3">{c.examples}</p>
                        {role !== "source" && (
                          <p className="mt-2 inline-block rounded-full bg-wash px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-2">
                            Default {d.replicas} × {fmtRps(d.capacity)}/s · {d.latencyMs}ms
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-5 text-ink-2">{c.summary}</p>
                      <div className="grid gap-6 text-sm sm:grid-cols-2">
                        <div>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">Use when</div>
                          <ul className="space-y-1.5 text-ink-2">
                            {c.whenToUse.map((w) => (
                              <li key={w} className="flex gap-2">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider">Tradeoffs</div>
                          <ul className="space-y-1.5 text-ink-2">
                            {c.tradeoffs.map((t) => (
                              <li key={t} className="flex gap-2">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-5 text-xs text-ink-3">
                        <span className="font-semibold text-ink">In the simulator: </span>
                        {ROLE_BEHAVIOR[role]}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
