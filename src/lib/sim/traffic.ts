export type Pattern = "steady" | "ramp" | "spike" | "wave";

export const PATTERNS: { id: Pattern; label: string; hint: string }[] = [
  { id: "steady", label: "Steady", hint: "Constant load at the target rate" },
  { id: "ramp", label: "Ramp", hint: "Climbs from 0 to 3× the target over 90s — find the breaking point" },
  { id: "spike", label: "Spike", hint: "5× bursts for 8s every 40s — like a viral post or flash sale" },
  { id: "wave", label: "Wave", hint: "Rises and falls ±60% like daily traffic" },
];

export function offeredRps(pattern: Pattern, base: number, t: number) {
  switch (pattern) {
    case "steady":
      return base;
    case "ramp":
      return base * 3 * Math.min(1, t / 90);
    case "spike":
      return t % 40 >= 20 && t % 40 < 28 ? base * 5 : base;
    case "wave":
      return base * (1 + 0.6 * Math.sin((2 * Math.PI * t) / 60));
  }
}
