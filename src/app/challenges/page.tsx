import { ChallengeList } from "@/components/ChallengeList";
import { NavLink, TopBar } from "@/components/TopBar";

export const metadata = { title: "Challenges · ArchFlow" };

export default function ChallengesPage() {
  return (
    <div className="flex-1">
      <TopBar>
        <nav className="flex gap-1">
          <NavLink href="/sandbox">Simulator</NavLink>
          <NavLink href="/challenges" active>
            Challenges
          </NavLink>
          <NavLink href="/#problems">Practice</NavLink>
          <NavLink href="/learn">Glossary</NavLink>
        </nav>
      </TopBar>
      <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <h1 className="mb-3 text-5xl font-bold tracking-tighter">Challenges</h1>
        <p className="mb-12 max-w-2xl text-lg text-ink-2">
          Real incidents, fixed traffic, a budget. Each component&apos;s specs are locked, so you win with architecture:
          replicas, caches, queues, autoscaling, retries and circuit breakers. Pass, then try to do it cheaper.
        </p>
        <ChallengeList />
      </main>
    </div>
  );
}
