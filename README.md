# ArchFlow

A visual distributed-systems simulator. Design a backend architecture, push simulated traffic through it, and watch request flow, latency propagation, queue buildup, failures and bottlenecks — then practice classic system design interview problems on the same canvas.

## Features

- **Simulator** (`/sandbox`) — drag components onto a canvas, wire them up, and run traffic (steady, ramp, spike, wave) from 10 to 50,000 rps. Edges animate with live throughput, nodes show load and status, and a metrics sheet charts throughput, latency, error rate and queue depth.
- **Chaos** — kill any node or inject latency and watch health checks reroute, queues back up, or errors cascade.
- **Live insights** — bottlenecks (with the replica count that fixes them), backlogged queues, single points of failure, unreachable nodes.
- **Interview practice** — six problems with briefs, graded feedback with hints, step-by-step reference walkthroughs, and one-click "Simulate reference".
- **Glossary** (`/learn`) — every component: what it does, when to use it, tradeoffs, and how the simulator models it.

## How the simulation works

`src/lib/sim/engine.ts` is a rate-based model that ticks every 100ms of simulated time:

- **Capacity** — each node handles `replicas × capacity` rps. Excess waits in a backlog; beyond ~1s of backlog, requests time out.
- **Queueing** — latency rises with utilization (a hockey-stick curve), plus time spent in the backlog.
- **Routing** — edges point the way requests travel. Routers split traffic by edge weight across healthy targets; compute nodes call every dependency (with cache-aside, a database beside a cache only sees misses); caches forward misses; queues are async and drain at their consumers' capacity.
- **Propagation** — end-to-end latency and failure probability fold back from the leaves to the clients.

Component defaults and routing roles live in `src/lib/sim/config.ts`.

## Develop

```bash
npm install
npm run dev
```

## Adding a problem

Problems live in `src/lib/problems.ts`. Each one has:

- `checkpoints` — what the grader checks: a component type exists (`kind: "component"`, optional `min`) or two types are connected (`kind: "connection"`, either direction).
- `solution` — reference nodes on a grid (`col`/`row`, optional simulation `config`) and edges (optional `ratio`: calls per request, or traffic weight for routers). Node order is the walkthrough order.
