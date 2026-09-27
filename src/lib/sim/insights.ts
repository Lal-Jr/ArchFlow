import { ROLE } from "./config";
import type { Compiled, Snapshot } from "./engine";
import { fmtMs, fmtPct, fmtRps } from "./format";

export type Severity = "critical" | "warning" | "info" | "good";

export interface Insight {
  id: string;
  severity: Severity;
  nodeId?: string;
  title: string;
  detail: string;
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

export function deriveInsights(g: Compiled, s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const hasCacheUpstream = (id: string) =>
    [...g.out.entries()].some(([from, links]) => links.some((l) => l.to === id) && g.out.get(from)!.some((l) => g.nodes.get(l.to)!.kind === "cache"));

  for (const id of g.order) {
    const n = g.nodes.get(id)!;
    const m = s.nodes[id];
    const role = ROLE[n.kind];
    const name = n.label;
    if (!m || role === "source") continue;

    if (m.status === "down") {
      const parents = [...g.out.entries()].filter(([, ls]) => ls.some((l) => l.to === id)).map(([p]) => g.nodes.get(p)!);
      const rerouted = parents.some((p) => ROLE[p.kind] === "route" && g.out.get(p.id)!.some((l) => l.to !== id && !g.nodes.get(l.to)!.config.down));
      out.push({
        id: `down-${id}`,
        severity: rerouted ? "warning" : "critical",
        nodeId: id,
        title: `${name} is down`,
        detail: rerouted
          ? "The load balancer's health checks route around it. The surviving instances now carry its share, so watch them overheat."
          : `Nothing routes around it, so every request that needs it fails after a ${fmtMs(1000)} timeout. Add redundancy in front of it.`,
      });
      continue;
    }

    if (role === "queue") {
      const growth = m.inRps - m.outRps - m.dropRps;
      if (m.capacity > 0 && g.out.get(id)!.length === 0 && m.inRps > 0) {
        out.push({
          id: `noconsumer-${id}`,
          severity: "critical",
          nodeId: id,
          title: `${name} has no consumers`,
          detail: "Messages pile up forever. Connect it to workers that process them.",
        });
      } else if (growth > 1) {
        out.push({
          id: `queue-${id}`,
          severity: m.backlog > 10_000 ? "critical" : "warning",
          nodeId: id,
          title: `${name} is backing up`,
          detail: `${fmtRps(m.inRps)}/s arriving, but consumers only drain ${fmtRps(m.outRps)}/s. The backlog of ${fmtRps(m.backlog)} messages grows by ${fmtRps(growth)} every second. Add worker replicas.`,
        });
      } else if (m.backlog > 1) {
        out.push({
          id: `drain-${id}`,
          severity: "info",
          nodeId: id,
          title: `${name} is draining`,
          detail: `${fmtRps(m.backlog)} messages buffered. The queue absorbed a burst that the workers are now catching up on. That's exactly what it's for.`,
        });
      }
      continue;
    }

    if (m.throttleRps > 0.5) {
      out.push({
        id: `throttle-${id}`,
        severity: "info",
        nodeId: id,
        title: `${name} is rejecting ${fmtPct((m.throttleRps / m.inRps) * 100)} of requests`,
        detail: `Those clients get HTTP 429 above ${fmtRps(n.config.rateLimit)}/s. That keeps the servers behind it healthy.`,
      });
    }

    if (m.status === "overloaded") {
      const per = n.config.capacity;
      const needed = Math.ceil(m.demandRps / (per * 0.7));
      const suggestion =
        (n.kind === "sql_db" || n.kind === "nosql_db") && !hasCacheUpstream(id)
          ? " Or put a cache in front of it to absorb repeated reads."
          : n.kind === "sql_db"
            ? " Add read replicas, or shard if the load is writes."
            : "";
      out.push({
        id: `hot-${id}`,
        severity: "critical",
        nodeId: id,
        title: `Bottleneck: ${name}`,
        detail: `${m.demandRps > m.inRps ? "Demand is" : "Receiving"} ${fmtRps(m.demandRps)}/s but it can only handle ${fmtRps(m.capacity)}/s (${n.config.replicas} × ${fmtRps(per)}). ${
          m.dropRps > 0.5 ? `${fmtRps(m.dropRps)}/s are timing out. ` : ""
        }Scale to ~${needed} replicas to run at 70%.${suggestion}`,
      });
    } else if (m.status === "hot") {
      out.push({
        id: `warm-${id}`,
        severity: "warning",
        nodeId: id,
        title: `${name} is at ${fmtPct(m.utilization * 100)}`,
        detail: `Queueing delay grows sharply above ~75% utilization. Its latency is ${fmtMs(m.ownMs)} against a baseline of ${fmtMs(n.config.latencyMs)}.`,
      });
    }

    if (m.status === "idle" && s.offeredRps > 0) {
      out.push({
        id: `idle-${id}`,
        severity: "info",
        nodeId: id,
        title: `${name} gets no traffic`,
        detail: "Edges carry requests in the direction of the arrow. Check that something calls it (arrow pointing into it).",
      });
    }

    const besideDb = [...g.out.values()].some(
      (ls) => ls.some((l) => l.to === id) && ls.some((l) => ["sql_db", "nosql_db"].includes(g.nodes.get(l.to)!.kind)),
    );
    if (n.kind === "cache" && m.inRps > 0 && besideDb) {
      out.push({
        id: `cache-${id}`,
        severity: "good",
        nodeId: id,
        title: `${name} absorbs ${fmtPct(n.config.hitRate * 100)} of reads`,
        detail: `The databases behind it see only the misses, so a hit rate drop from ${fmtPct(n.config.hitRate * 100)} to 50% would multiply their load.`,
      });
    }
  }

  if (s.ignoredEdges.length) {
    out.push({
      id: "cycles",
      severity: "info",
      title: s.ignoredEdges.length > 1 ? `${s.ignoredEdges.length} edges form cycles` : "An edge forms a cycle",
      detail: "Traffic can't loop forever, so edges that point back upstream are ignored. They're drawn dashed.",
    });
  }

  const spof = g.order.filter((id) => {
    const n = g.nodes.get(id)!;
    return (
      n.config.replicas === 1 &&
      ["service", "websocket", "worker", "sql_db", "api_gateway"].includes(n.kind) &&
      (s.nodes[id]?.inRps ?? 0) > 0
    );
  });
  if (spof.length) {
    out.push({
      id: "spof",
      severity: "warning",
      nodeId: spof[0],
      title: "Single point of failure",
      detail: `${spof.map((id) => g.nodes.get(id)!.label).join(", ")} ${spof.length > 1 ? "run" : "runs"} one instance. If ${
        spof.length > 1 ? "any fails" : "it fails"
      }, so does the system. Try killing it to see.`,
    });
  }

  if (s.offeredRps > 0 && !out.some((i) => i.severity === "critical" || i.severity === "warning")) {
    out.push({
      id: "healthy",
      severity: "good",
      title: "Healthy at this load",
      detail: "Every component is under 75% utilization. Push the traffic higher, or try the Ramp pattern to find the first component to break.",
    });
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
