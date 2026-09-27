import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideFaq } from "@/components/GuideFaq";
import { NavLink, TopBar } from "@/components/TopBar";
import { CONCEPTS, FRAMEWORK } from "@/lib/guide";
import { PROBLEMS } from "@/lib/problems";

export const metadata = {
  title: "Guide · ArchFlow",
  description: "How to answer any system design interview question, the core concepts, and answers to common questions about ArchFlow.",
};

export default function GuidePage() {
  return (
    <div className="flex-1">
      <TopBar>
        <nav className="flex gap-1">
          <NavLink href="/sandbox">Simulator</NavLink>
          <NavLink href="/challenges">Challenges</NavLink>
          <NavLink href="/#problems">Practice</NavLink>
          <NavLink href="/guide" active>
            Guide
          </NavLink>
          <NavLink href="/learn">Glossary</NavLink>
        </nav>
      </TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h1 className="mb-3 text-5xl font-bold tracking-tighter">The system design guide</h1>
        <p className="mb-8 max-w-2xl text-lg text-ink-2">
          How to answer any system design question, the concepts every answer draws on, and answers to what people ask most about
          ArchFlow.
        </p>
        <div className="mb-16 flex flex-wrap gap-2 text-sm">
          {[
            ["#framework", "The 7-step framework"],
            ["#concepts", "Core concepts"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full bg-wash px-4 py-2 font-medium hover:bg-line">
              {label}
            </a>
          ))}
        </div>

        <section id="framework" className="mb-20 scroll-mt-6">
          <h2 className="mb-2 border-b-2 border-ink pb-3 text-3xl font-bold tracking-tight">Answering any question in 45 minutes</h2>
          <p className="mb-8 mt-4 max-w-2xl text-ink-2">
            Every problem guide in ArchFlow follows these steps. Interviewers grade the reasoning at each one, not just the final
            diagram.
          </p>
          <ol className="space-y-4">
            {FRAMEWORK.map((f, i) => (
              <li key={f.step} className="grid gap-4 rounded-2xl border border-line p-6 md:grid-cols-[1fr_1.1fr]">
                <div>
                  <div className="mb-1 flex items-baseline gap-3">
                    <span className="font-mono text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="text-xl font-bold tracking-tight">{f.step}</h3>
                    <span className="rounded-full bg-wash px-2 py-0.5 text-xs font-medium text-ink-2">{f.minutes}</span>
                  </div>
                  <p className="mb-3 text-ink-2">{f.goal}</p>
                  <ul className="space-y-1.5 text-sm text-ink-2">
                    {f.do.map((d) => (
                      <li key={d} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <blockquote className="self-start rounded-xl bg-wash p-4 text-sm leading-relaxed">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-3">What it sounds like</div>
                  &ldquo;{f.say}&rdquo;
                </blockquote>
              </li>
            ))}
          </ol>
        </section>

        <section id="concepts" className="mb-20 scroll-mt-6">
          <h2 className="mb-2 border-b-2 border-ink pb-3 text-3xl font-bold tracking-tight">Core concepts</h2>
          <p className="mb-8 mt-4 max-w-2xl text-ink-2">
            The building blocks behind almost every answer. For individual components (load balancers, queues, databases), see the{" "}
            <Link href="/learn" className="font-semibold underline">
              glossary
            </Link>
            .
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {CONCEPTS.map((c) => (
              <article key={c.name} className="rounded-2xl border border-line p-5">
                <h3 className="mb-2 text-lg font-bold tracking-tight">{c.name}</h3>
                <p className="mb-3 text-sm text-ink-2">{c.what}</p>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-good">Use when</dt>
                    <dd className="text-ink-2">{c.when}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-warn-ink">Tradeoff</dt>
                    <dd className="text-ink-2">{c.tradeoff}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="mb-16 scroll-mt-6">
          <h2 className="mb-6 border-b-2 border-ink pb-3 text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          <GuideFaq />
        </section>

        <Link href="/#problems" className="group flex items-center gap-5 rounded-2xl bg-ink p-8 text-white">
          <span className="flex-1">
            <span className="block text-2xl font-bold tracking-tight">Put it into practice</span>
            <span className="block text-white/60">{PROBLEMS.length} interview problems, each with a full guide and a simulator.</span>
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-1">
            <ArrowRight size={20} />
          </span>
        </Link>
      </main>
    </div>
  );
}
