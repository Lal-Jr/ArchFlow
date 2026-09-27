export function fmtRps(n: number) {
  if (!isFinite(n)) return "∞";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 10) return `${Math.round(n)}`;
  return n.toFixed(n > 0 && n < 1 ? 2 : 1).replace(/\.0+$/, "");
}

export function fmtMs(n: number) {
  if (!isFinite(n)) return "∞";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  if (n >= 100) return `${Math.round(n)}ms`;
  return `${n.toFixed(1)}ms`;
}

export function fmtPct(n: number) {
  if (!isFinite(n)) return "∞";
  if (n >= 10) return `${Math.round(n)}%`;
  return `${n.toFixed(1)}%`;
}
