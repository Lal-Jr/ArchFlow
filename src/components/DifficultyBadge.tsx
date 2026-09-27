import type { Difficulty } from "@/lib/problems";

const STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  Hard: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[difficulty]}`}>
      {difficulty}
    </span>
  );
}
