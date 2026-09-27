import Link from "next/link";
import { Activity, ArrowRight, BookOpen, GraduationCap, Skull, Waves } from "lucide-react";
import { HeroDiagram } from "@/components/HeroDiagram";
import { ProblemList } from "@/components/ProblemList";
import { NavLink, Wordmark } from "@/components/TopBar";

const FEATURES = [
  {
    Icon: Waves,
    title: "Push real traffic shapes",
    body: "Steady load, a 3× ramp, flash-sale spikes or a daily wave. Dial it from 10 to 50,000 requests per second.",
  },
  {
    Icon: Activity,
    title: "Watch latency propagate",
    body: "Every component queues as it fills up. See a slow database add up to a slow page, hop by hop, on live charts.",
  },
  {
    Icon: Skull,
    title: "Break things on purpose",
    body: "Kill a node or inject latency. Health checks reroute, queues back up, and errors cascade — or they don't.",
  },
  {
    Icon: GraduationCap,
    title: "Practice the interview",
    body: "Six classic design problems with briefs, graded feedback, hints and step-by-step reference walkthroughs.",
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
    body: "Routers split traffic, caches absorb hits, queues decouple producers from consumers. Latency and failures fold back to the client.",
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="bg-ink text-white">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Wordmark />
          <div className="hidden gap-1 sm:flex">
            <NavLink href="/sandbox">Simulator</NavLink>
            <NavLink href="#problems">Practice</NavLink>
            <NavLink href="/learn">Glossary</NavLink>
          </div>
          <Link href="/sandbox" className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-white/90">
            Open simulator
          </Link>
        </nav>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="mb-5 text-sm font-medium text-white/60">Distributed systems simulator</p>
            <h1 className="mb-6 text-5xl font-bold leading-[1.02] tracking-tighter sm:text-7xl">
              Design it.
              <br />
              Load it.
              <br />
              Break it.
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-white/70">
              Draw a backend architecture, send simulated traffic through it, and watch requests flow, queues build up, and
              bottlenecks light up before they happen in production.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sandbox"
                className="flex items-center gap-2 rounded-lg bg-white px-5 py-3.5 font-semibold text-ink hover:bg-white/90"
              >
                Open the simulator <ArrowRight size={18} />
              </Link>
              <Link href="#problems" className="rounded-lg bg-white/10 px-5 py-3.5 font-semibold hover:bg-white/15">
                Practice interview problems
              </Link>
            </div>
          </div>
          <HeroDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="mb-12 max-w-2xl text-4xl font-bold tracking-tight">
          A whiteboard that pushes back.
        </h2>
        <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink">
                <f.Icon size={22} color="#fff" />
              </span>
              <div>
                <h3 className="mb-1.5 text-lg font-bold tracking-tight">{f.title}</h3>
                <p className="leading-relaxed text-ink-2">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-wash">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-2 text-3xl font-bold tracking-tight">How the model works</h2>
          <p className="mb-10 max-w-2xl text-ink-2">
            A rate-based simulation that updates ten times a second. It&apos;s simple enough to reason about and faithful
            enough to teach the real failure modes.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {MODEL.map((m) => (
              <div key={m.n} className="border-t-2 border-ink pt-4">
                <div className="mb-3 font-mono text-sm text-ink-3">{m.n}</div>
                <h3 className="mb-2 text-xl font-bold tracking-tight">{m.title}</h3>
                <p className="leading-relaxed text-ink-2">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="problems" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-20 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 text-4xl font-bold tracking-tight">Interview problems</h2>
            <p className="text-ink-2">Design it yourself, get graded, then load the reference design into the simulator.</p>
          </div>
        </div>
        <ProblemList />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <Link
          href="/learn"
          className="group flex items-center gap-5 rounded-2xl bg-ink p-8 text-white"
        >
          <BookOpen size={28} />
          <span className="flex-1">
            <span className="block text-2xl font-bold tracking-tight">Know your building blocks</span>
            <span className="block text-white/60">17 components: what they do, when to use them, and their tradeoffs.</span>
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink transition-transform group-hover:translate-x-1">
            <ArrowRight size={20} />
          </span>
        </Link>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl justify-between px-4 py-6 text-sm text-ink-3 sm:px-6">
          <span className="font-semibold text-ink">ArchFlow</span>
          <span>Built for learning system design.</span>
        </div>
      </footer>
    </main>
  );
}
