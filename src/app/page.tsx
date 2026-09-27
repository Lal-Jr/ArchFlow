import Link from "next/link";
import { ProblemGrid } from "@/components/ProblemGrid";

const STEPS = [
  { n: "1", title: "Read the brief", body: "Requirements and back-of-envelope numbers, just like the interviewer gives you." },
  { n: "2", title: "Draw your design", body: "Drag load balancers, caches, queues and databases onto the canvas and wire them up." },
  { n: "3", title: "Get feedback", body: "Check your diagram against the key ideas. Get Socratic hints, not just answers." },
  { n: "4", title: "Study the solution", body: "Step through a reference architecture, one component at a time, and why it's there." },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-16 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">
          Arch<span className="text-violet-400">Flow</span>
        </span>
        <Link href="/learn" className="text-sm text-zinc-400 hover:text-zinc-100">
          Component glossary →
        </Link>
      </nav>

      <section className="mb-16 max-w-2xl">
        <h1 className="mb-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Learn system design by <span className="text-violet-400">drawing it</span>.
        </h1>
        <p className="text-lg text-zinc-400">
          Practice the architecture diagrams that come up in system design interviews. Build your answer on a canvas,
          get instant feedback, then walk through a reference solution.
        </p>
      </section>

      <section className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n}>
            <div className="mb-2 font-mono text-sm text-violet-400">{s.n.padStart(2, "0")}</div>
            <div className="mb-1 font-medium">{s.title}</div>
            <p className="text-sm text-zinc-500">{s.body}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-5 text-xl font-semibold">Problems</h2>
        <ProblemGrid />
      </section>
    </main>
  );
}
