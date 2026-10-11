import { Database, Monitor, Network, Server, Zap, type LucideIcon } from "lucide-react";
import { gridGraph, toSim } from "@/lib/graph";
import { fmtMs, fmtRps, fmtUsd } from "@/lib/sim/format";
import { probeCapacity } from "@/lib/sim/probe";

type N = { id: string; x: number; y: number; Icon: LucideIcon; label: string; tag?: string };

const NODES: N[] = [
  { id: "c", x: 10, y: 140, Icon: Monitor, label: "Clients" },
  { id: "lb", x: 130, y: 140, Icon: Network, label: "Router" },
  { id: "read", x: 250, y: 60, Icon: Server, label: "Feed API", tag: "GET /feed" },
  { id: "write", x: 250, y: 220, Icon: Server, label: "Post API", tag: "POST /posts" },
  { id: "cache", x: 370, y: 20, Icon: Zap, label: "Cache" },
  { id: "db", x: 370, y: 140, Icon: Database, label: "Postgres" },
];
const S = 52;
const center = (id: string) => {
  const n = NODES.find((n) => n.id === id)!;
  return { x: n.x + S / 2, y: n.y + S / 2 };
};
/** [from, to, dots, write path?] */
const LINKS: [string, string, number, boolean][] = [
  ["c", "lb", 5, false],
  ["lb", "read", 4, false],
  ["lb", "write", 1, true],
  ["read", "cache", 3, false],
  ["read", "db", 1, false],
  ["write", "db", 1, true],
];

/** The same design, as the engine sees it — the readout beside the drawing is measured, not made up. */
function heroDesign() {
  const g = gridGraph(
    [
      ["c", "client", "Clients", 0, 1],
      ["lb", "load_balancer", "Router", 1, 1],
      ["read", "service", "Feed API", 2, 0],
      ["write", "service", "Post API", 2, 2, { replicas: 2 }],
      ["cache", "cache", "Cache", 3, 0, { hitRate: 0.9 }],
      ["db", "sql_db", "Postgres", 3, 1],
    ],
    [["c", "lb"], ["lb", "read"], ["lb", "write"], ["read", "cache"], ["read", "db"], ["write", "db"]],
  );
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  byId.c.data.endpoints = [
    { method: "GET", path: "/feed", share: 95 },
    { method: "POST", path: "/posts", share: 5 },
  ];
  byId.read.data.serves = ["GET /feed"];
  byId.write.data.serves = ["POST /posts"];
  return toSim(g.nodes, g.edges);
}

/** A small read/write-split design with its measured capacity. Computed once, when the page is built. */
export function HeroDiagram() {
  const sim = heroDesign();
  const r = probeCapacity(sim.nodes, sim.edges);
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_20px_50px_-24px_rgb(28_54_158/0.35)]">
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-ink-3">
        <span className="font-mono">feed-service.design</span>
        <span className="font-mono">#{r.fingerprint}</span>
      </div>
      <svg
        viewBox="0 0 440 300"
        className="h-auto w-full"
        role="img"
        aria-label="Clients send reads and writes through a router: reads go to a feed service backed by a cache, writes to a post service that writes to Postgres"
      >
        {LINKS.map(([a, b, dots, write]) => {
          const p = center(a);
          const q = center(b);
          const mx = (p.x + q.x) / 2;
          const d = `M${p.x},${p.y} L${mx},${p.y} L${mx},${q.y} L${q.x},${q.y}`;
          const color = write ? "#8a5a00" : "#2b4fd8";
          return (
            <g key={a + b}>
              <path d={d} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={2} strokeDasharray={write ? "5 4" : undefined} />
              {Array.from({ length: dots }, (_, i) => (
                <circle key={i} r={3.2} fill={color}>
                  {/* Negative offsets start every dot mid-path, so none sits at the origin waiting for its turn. */}
                  <animateMotion dur="1.8s" begin={`-${(i * 1.8) / dots}s`} repeatCount="indefinite" path={d} />
                </circle>
              ))}
            </g>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={S} height={S} rx={10} fill="#fff" stroke="#d4d4d4" />
            <n.Icon x={n.x + 14} y={n.y + 14} width={24} height={24} color="#000" strokeWidth={1.8} />
            <text x={n.x + S / 2} y={n.y + S + 15} textAnchor="middle" className="fill-ink-2 text-[11px] font-medium">
              {n.label}
            </text>
            {n.tag && (
              <g transform={`translate(${n.x + S / 2} ${n.y - 10})`}>
                <rect x={-36} y={-9} width={72} height={16} rx={4} fill={n.tag.startsWith("GET") ? "#eceffd" : "#fff5dd"} />
                <text textAnchor="middle" y={3} className={`font-mono text-[9px] font-semibold ${n.tag.startsWith("GET") ? "fill-accent-ink" : "fill-warn-ink"}`}>
                  {n.tag}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      <dl className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-line text-center">
        {[
          ["Sustains", `${fmtRps(r.ceilingRps)} rps`],
          ["p99 at peak", fmtMs(r.p99AtCeilingMs)],
          ["Costs", `${fmtUsd(r.costAtCeiling)}/mo`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-2 py-2.5">
            <dd className="text-base font-bold tracking-tight tabular-nums">{v}</dd>
            <dt className="text-[10px] uppercase tracking-wide text-ink-3">{k}</dt>
          </div>
        ))}
      </dl>
      {r.limit && (
        <p className="mt-3 text-xs text-ink-3">
          Limited by <span className="font-semibold text-ink">{r.limit.label}</span>. Every number here comes from the same engine
          you design in.
        </p>
      )}
    </div>
  );
}
