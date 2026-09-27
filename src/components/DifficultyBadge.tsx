import type { Difficulty } from "@/lib/problems";

const DOTS: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

export function DifficultyBadge({ difficulty, invert }: { difficulty: Difficulty; invert?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${invert ? "text-white/70" : "text-ink-2"}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full ${
              i <= DOTS[difficulty] ? (invert ? "bg-white" : "bg-ink") : invert ? "bg-white/25" : "bg-line-2"
            }`}
          />
        ))}
      </span>
      {difficulty}
    </span>
  );
}
