import type { Difficulty } from "@/lib/problems";

const DOTS: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= DOTS[difficulty] ? "bg-ink" : "bg-line-2"}`} />
        ))}
      </span>
      {difficulty}
    </span>
  );
}
