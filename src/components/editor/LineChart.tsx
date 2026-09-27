"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/sim/engine";

export interface Series {
  key: string;
  label: string;
  value: (p: HistoryPoint) => number;
  color: string;
  dashed?: boolean;
}

const H = 92;
const PAD = { top: 8, right: 10, bottom: 4, left: 38 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/**
 * Small-multiple time series: one y-axis, hairline grid, 2px lines, a light area wash
 * under the primary series, and a crosshair shared across sibling charts via `hover`.
 */
export function LineChart({
  data,
  series,
  format,
  hover,
  onHover,
}: {
  data: HistoryPoint[];
  series: Series[];
  format: (n: number) => string;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(240);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const max = niceMax(Math.max(0, ...data.flatMap((p) => series.map((s) => s.value(p)))) * 1.1);
  const iw = Math.max(10, w - PAD.left - PAD.right);
  const ih = H - PAD.top - PAD.bottom;
  const slots = Math.max(n - 1, 1);
  const x = (i: number) => PAD.left + (i / slots) * iw;
  const y = (v: number) => PAD.top + ih - (Math.min(v, max) / max) * ih;
  const line = (s: Series) => data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.value(p)).toFixed(1)}`).join("");
  const primary = series[0];
  const area = n > 1 ? `${line(primary)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const hi = hover != null && hover < n ? hover : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - PAD.left) / iw) * slots);
    onHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={H} onPointerMove={onMove} onPointerLeave={() => onHover(null)} className="block touch-none">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke="#ececec" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(max * f)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[10px] tabular-nums">
              {format(max * f)}
            </text>
          </g>
        ))}
        {n > 1 && <path d={area} fill={primary.color} opacity={0.07} />}
        {n > 1 &&
          [...series].reverse().map((s) => (
            <path
              key={s.key}
              d={line(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "4 4" : undefined}
            />
          ))}
        {n > 0 && hi == null && (
          <circle cx={x(n - 1)} cy={y(primary.value(data[n - 1]))} r={4} fill={primary.color} stroke="#fff" strokeWidth={2} />
        )}
        {hi != null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={PAD.top} y2={PAD.top + ih} stroke="#000" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.key} cx={x(hi)} cy={y(s.value(data[hi]))} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </>
        )}
      </svg>
      {hi != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md bg-ink px-2 py-1.5 text-[11px] text-white shadow-lg"
          style={{ left: x(hi) > w / 2 ? x(hi) - 8 : x(hi) + 8, transform: x(hi) > w / 2 ? "translateX(-100%)" : undefined }}
        >
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-0.5 w-2.5" style={{ background: s.color === "#000000" ? "#fff" : s.color }} />
              <span className="font-semibold tabular-nums">{format(s.value(data[hi]))}</span>
              {series.length > 1 && <span className="text-white/60">{s.label}</span>}
            </div>
          ))}
          <div className="text-white/60">t = {data[hi].t}s</div>
        </div>
      )}
    </div>
  );
}
