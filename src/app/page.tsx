import Link from "next/link";
import { ArrowRight, BookOpen, Gauge, GitCompare, Route, Siren } from "lucide-react";
import { HeroDiagram } from "@/components/HeroDiagram";
import { ProblemList } from "@/components/ProblemList";
import { PROBLEMS } from "@/lib/problems";
import { NavLink, Wordmark } from "@/components/TopBar";

const FEATURES = [
  {
    Icon: Route,
    title: "Model the requests, not just the boxes",
    body: "Give clients a request mix like 95% GET /feed and 5% POST /posts. Reads stop at caches; writes go through to the database. Bind each endpoint to the services that handle it.",
  },
  {
    Icon: Gauge,
    title: "Measure what a design sustains",
    body: "One click finds the most steady traffic your design holds within its error and p99 budget, names the component that gives out first, and prices it per 1,000 rps.",
  },
  {
    Icon: GitCompare,
    title: "Compare versions side by side",
    body: "Keep each measured build and line them up. The engine has no randomness, so a build's fingerprint always measures the same, and a better number is a better design.",
  },
  {
    Icon: Siren,
    title: "Rehearse the incident",
    body: "Spikes, ramps and daily waves up to 50,000 rps. Kill a database, slow a dependency, then see whether retries, circuit breakers and autoscaling save you.",
  },
];

const MODEL = [
  {
    n: "01",
    title: "Capacity",
    body: "Each component handles replicas × requests/sec. Past that, work waits in a backlog; past a second of backlog, requests time out.",
  },
  {
    n: "02",
    title: "Queueing",
    body: "Latency climbs with utilization — the hockey stick. At 50% you barely notice. At 90% a 10ms call takes much longer.",
  },
  {
    n: "03",
    title: "Propagation",
    body: "Routers split traffic by endpoint, caches absorb reads, queues decouple producers from consumers. Latency and failures fold back to the client, per endpoint.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="af-blueprint border-b border-line">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Wordmark />
          <div className="hidden gap-1 sm:flex">
            <NavLink href="/sandbox">Lab</NavLink>
            <NavLink href="/challenges">Challenges</NavLink>
            <NavLink href="#problems">Practice</NavLink>
            <NavLink href="/guide">Guide</NavLink>
            <NavLink href="/learn">Glossary</NavLink>
          </div>
          <Link href="/sandbox" className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-ink">
            Open the lab
          </Link>
        </nav>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1fr_1fr] lg:pt-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-wash px-3 py-1 text-sm font-medium text-accent-ink">
              System design interview lab
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Put a number on
              <br />
              your <span className="text-accent">architecture.</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-ink-2">
              Sketch the system you&apos;d draw on the whiteboard, give it a real request mix, and ArchFlow measures how much
              traffic it sustains, what it costs, and which component limits it. Defend every box with numbers.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sandbox"
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3.5 font-semibold text-white hover:bg-accent-ink"
              >
                Open the lab <ArrowRight size={18} />
              </Link>
              <Link href="#problems" className="rounded-lg border border-line-2 bg-white px-5 py-3.5 font-semibold hover:border-ink">
                Browse {PROBLEMS.length} interview problems
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-3">Open source · runs in your browser · no sign-up</p>
          </div>
          <HeroDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="mb-3 max-w-2xl text-4xl font-bold tracking-tight">From a sketch to a defensible design.</h2>
        <p className="mb-12 max-w-2xl text-ink-2">
          Interviewers ask &ldquo;how many requests can this handle?&rdquo; and &ldquo;what happens when the database goes
          away?&rdquo; ArchFlow answers both before they do.
        </p>
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent-ink">
                <f.Icon size={22} />
              </span>
              <div>
                <h3 className="mb-1.5 text-lg font-bold tracking-tight">{f.title}</h3>
                <p className="leading-relaxed text-ink-2">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-2 text-3xl font-bold tracking-tight">How the model works</h2>
          <p className="mb-10 max-w-2xl text-ink-2">
            A rate-based simulation that updates ten times a second, with no randomness: the same design always produces the
            same result. Simple enough to reason about, faithful enough to teach the real failure modes.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {MODEL.map((m) => (
              <div key={m.n} className="border-t-2 border-accent pt-4">
                <div className="mb-3 font-mono text-sm text-ink-3">{m.n}</div>
                <h3 className="mb-2 text-xl font-bold tracking-tight">{m.title}</h3>
                <p className="leading-relaxed text-ink-2">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <Link href="/challenges" className="group grid items-center gap-8 rounded-2xl border border-line bg-white p-8 sm:p-12 md:grid-cols-[1fr_auto] hover:border-ink">
          <div>
            <p className="mb-3 text-sm font-medium text-accent">Incident drills</p>
            <h2 className="mb-3 text-4xl font-bold tracking-tight">Four on-call scenarios. One budget each.</h2>
            <p className="max-w-xl text-ink-2">
              A Black Friday surge, a database outage, a retry storm and an order backlog, each with targets for errors, p99
              latency and monthly cost. Component specs are locked, so the only lever is the architecture.
            </p>
          </div>
          <span className="flex items-center gap-2 justify-self-start rounded-lg bg-ink px-5 py-3.5 font-semibold text-white md:justify-self-end">
            Start a drill <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      <section id="problems" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 text-4xl font-bold tracking-tight">{PROBLEMS.length} interview problems</h2>
            <p className="text-ink-2">
              The questions top companies ask. Design it yourself, get graded, read the full guide, then load the reference design
              into the lab and measure it.
            </p>
          </div>
        </div>
        <ProblemList />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Link
          href="/learn"
          className="group flex items-center gap-5 rounded-2xl bg-paper p-8 hover:bg-accent-wash"
        >
          <BookOpen size={28} />
          <span className="flex-1">
            <span className="block text-2xl font-bold tracking-tight">Know your building blocks</span>
            <span className="block text-ink-2">17 components: what they do, when to use them, and their tradeoffs.</span>
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white transition-transform group-hover:translate-x-1">
            <ArrowRight size={20} />
          </span>
        </Link>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl justify-between px-4 py-6 text-sm text-ink-3 sm:px-6">
          <span className="font-semibold text-ink">ArchFlow</span>
          <span>A system design lab. Open source, in your browser.</span>
        </div>
      </footer>
    </main>
  );
}
