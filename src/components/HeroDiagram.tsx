import { Database, Layers, Monitor, Network, Server, Zap, type LucideIcon } from "lucide-react";

type N = { id: string; x: number; y: number; Icon: LucideIcon; label: string; hot?: boolean };

const NODES: N[] = [
  { id: "c", x: 20, y: 150, Icon: Monitor, label: "Clients" },
  { id: "lb", x: 150, y: 150, Icon: Network, label: "LB" },
  { id: "api", x: 280, y: 70, Icon: Server, label: "API" },
  { id: "api2", x: 280, y: 230, Icon: Server, label: "API" },
  { id: "cache", x: 410, y: 20, Icon: Zap, label: "Cache" },
  { id: "db", x: 410, y: 150, Icon: Database, label: "DB", hot: true },
  { id: "q", x: 410, y: 280, Icon: Layers, label: "Queue" },
];
const S = 56;
const center = (id: string) => {
  const n = NODES.find((n) => n.id === id)!;
  return { x: n.x + S / 2, y: n.y + S / 2 };
};
const LINKS: [string, string, number][] = [
  ["c", "lb", 5],
  ["lb", "api", 3],
  ["lb", "api2", 3],
  ["api", "cache", 3],
  ["api", "db", 2],
  ["api2", "db", 2],
  ["api2", "q", 2],
];

/** Decorative: requests flowing through a small system, with one database running hot. */
export function HeroDiagram() {
  return (
    <svg viewBox="0 0 490 360" className="h-auto w-full" role="img" aria-label="Requests flowing from clients through a load balancer to APIs, a cache, a database under strain, and a queue">
      {LINKS.map(([a, b, dots]) => {
        const p = center(a);
        const q = center(b);
        const mx = (p.x + q.x) / 2;
        const d = `M${p.x},${p.y} L${mx},${p.y} L${mx},${q.y} L${q.x},${q.y}`;
        const hot = b === "db";
        return (
          <g key={a + b}>
            <path d={d} fill="none" stroke={hot ? "#e11900" : "#ffffff"} strokeOpacity={hot ? 0.9 : 0.35} strokeWidth={hot ? 2.5 : 2} />
            {Array.from({ length: dots }, (_, i) => (
              <circle key={i} r={3.5} fill={hot ? "#e11900" : "#fff"} stroke="#000" strokeWidth={2}>
                <animateMotion dur={hot ? "2.6s" : "1.6s"} begin={`${(i * (hot ? 2.6 : 1.6)) / dots}s`} repeatCount="indefinite" path={d} />
              </circle>
            ))}
          </g>
        );
      })}
      {NODES.map((n) => (
        <g key={n.id}>
          {n.hot && (
            <rect x={n.x - 6} y={n.y - 6} width={S + 12} height={S + 12} rx={14} fill="none" stroke="#e11900" strokeWidth={2}>
              <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
            </rect>
          )}
          <rect x={n.x} y={n.y} width={S} height={S} rx={10} fill="#fff" />
          <n.Icon x={n.x + 16} y={n.y + 12} width={24} height={24} color="#000" strokeWidth={2} />
          <text x={n.x + S / 2} y={n.y + S + 16} textAnchor="middle" className="fill-white/60 text-[11px] font-medium">
            {n.label}
          </text>
        </g>
      ))}
      <g transform="translate(386 214)">
        <rect width="104" height="22" rx="11" fill="#e11900" />
        <text x="52" y="15" textAnchor="middle" className="fill-white text-[10px] font-bold uppercase tracking-wider">
          Overloaded
        </text>
      </g>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={474} y={320 - i * 9} width={10} height={6} rx={2} fill="#ffc043">
          <animate attributeName="opacity" values="0;1;1" keyTimes="0;0.3;1" dur="3s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}
