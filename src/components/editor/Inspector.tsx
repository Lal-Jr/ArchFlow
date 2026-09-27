"use client";

import { ArrowLeftRight, Minus, Plus, Trash2, X } from "lucide-react";
import { CATALOG_BY_TYPE } from "@/lib/catalog";
import type { ArchNodeData, ArchNodeType, FlowEdgeType } from "@/lib/graph";
import {
  CALLER_ROLES,
  COST_PER_REPLICA,
  resolveConfig,
  ROLE,
  ROLE_BEHAVIOR,
  SCALABLE_ROLES,
  type NodeConfig,
} from "@/lib/sim/config";
import { AUTOSCALE_TARGET, autoRatio, BREAKER_COOLDOWN_S, PROVISION_DELAY_S } from "@/lib/sim/engine";
import { fmtMs, fmtPct, fmtRps, fmtUsd } from "@/lib/sim/format";
import { ComponentIcon } from "../ComponentIcon";
import { useSnapshot } from "./useSimulation";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border-0 bg-wash px-3 py-2 text-sm tabular-nums outline-none ring-1 ring-transparent focus:bg-white focus:ring-ink";

function NumberInput({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; step?: number }) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      onKeyDown={(e) => e.stopPropagation()}
      className={inputCls}
    />
  );
}

function Stepper({
  value,
  onChange,
  min = 1,
  max = 100,
  noun = "replica",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  noun?: string;
}) {
  return (
    <div className="flex items-center rounded-lg bg-wash">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="p-2.5 hover:text-ink-2" aria-label={`Remove ${noun}`}>
        <Minus size={14} />
      </button>
      <span className="flex-1 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="p-2.5 hover:text-ink-2" aria-label={`Add ${noun}`}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
  danger,
}: {
  on: boolean;
  onChange: (b: boolean) => void;
  label: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-lg bg-wash px-3 py-2.5 text-left text-sm"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-ink-3">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? (danger ? "bg-bad" : "bg-ink") : "bg-line-2"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Header({ title, onClose, onDelete, icon }: { title: string; onClose: () => void; onDelete: () => void; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
      {icon}
      <h2 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">{title}</h2>
      <button onClick={onDelete} title="Delete" className="rounded-full p-1.5 text-ink-3 hover:bg-bad-wash hover:text-bad">
        <Trash2 size={16} />
      </button>
      <button onClick={onClose} title="Close" className="rounded-full p-1.5 text-ink-3 hover:bg-wash hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}

export function NodeInspector({
  node,
  hasSyncDeps,
  onChange,
  onDelete,
  onClose,
}: {
  node: ArchNodeType;
  /** Whether this node calls anything synchronously — retries and breakers only matter then. */
  hasSyncDeps: boolean;
  onChange: (data: Partial<ArchNodeData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const snap = useSnapshot();
  const m = snap?.nodes[node.id];
  const kind = node.data.kind;
  const info = CATALOG_BY_TYPE[kind];
  const role = ROLE[kind];
  const cfg = resolveConfig(kind, node.data.config);
  const set = (patch: Partial<NodeConfig>) => onChange({ config: { ...node.data.config, ...patch } });
  const live = m?.replicas ?? cfg.replicas;

  return (
    <div>
      <Header
        title={info.label}
        onClose={onClose}
        onDelete={onDelete}
        icon={
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink">
            <ComponentIcon type={kind} size={16} color="#fff" />
          </span>
        }
      />
      <div className="space-y-5 p-5">
        <Field label="Name">
          <input
            value={node.data.label}
            onChange={(e) => onChange({ label: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            className={inputCls}
          />
        </Field>

        {m && role !== "source" && (
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-line text-center">
            {[
              ["In", `${fmtRps(m.inRps)}/s`],
              ["Load", isFinite(m.utilization) ? fmtPct(m.utilization * 100) : "—"],
              [role === "queue" ? "Queued" : "Latency", m.status === "down" ? "—" : role === "queue" ? fmtRps(m.backlog) : fmtMs(m.ownMs)],
              ["Out", `${fmtRps(m.outRps)}/s`],
              ["Dropped", `${fmtRps(m.dropRps)}/s`],
              ["Downstream", fmtMs(m.e2eMs)],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-2 py-2.5">
                <div className="text-sm font-semibold tabular-nums">{v}</div>
                <div className="text-[10px] uppercase tracking-wide text-ink-3">{k}</div>
              </div>
            ))}
          </div>
        )}

        {role !== "source" && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider">Capacity</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label={cfg.autoscale ? "Min replicas" : "Replicas"}>
                <Stepper value={cfg.replicas} onChange={(replicas) => set({ replicas })} />
              </Field>
              <Field label="Each handles" hint="rps">
                <NumberInput value={cfg.capacity} onChange={(capacity) => set({ capacity })} step={100} />
              </Field>
            </div>
            <Field label="Base latency" hint="ms">
              <NumberInput value={cfg.latencyMs} onChange={(latencyMs) => set({ latencyMs })} step={1} />
            </Field>
            <p className="flex justify-between text-xs text-ink-3">
              <span>
                Total capacity <span className="font-semibold text-ink">{fmtRps(live * cfg.capacity)}/s</span>
                {live !== cfg.replicas && ` (${live} replicas now)`}
              </span>
              <span>
                <span className="font-semibold text-ink">{fmtUsd(COST_PER_REPLICA[kind] * live)}</span>/mo
              </span>
            </p>
          </div>
        )}

        {SCALABLE_ROLES.includes(role) && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider">Autoscaling</h3>
            <Toggle
              label="Autoscale"
              hint={`Targets ${AUTOSCALE_TARGET * 100}% load. New replicas take ${PROVISION_DELAY_S}s to start.`}
              on={cfg.autoscale}
              onChange={(autoscale) => set({ autoscale })}
            />
            {cfg.autoscale && (
              <Field label="Max replicas">
                <Stepper
                  value={Math.max(cfg.maxReplicas, cfg.replicas)}
                  min={cfg.replicas}
                  noun="max replica"
                  onChange={(maxReplicas) => set({ maxReplicas })}
                />
              </Field>
            )}
          </div>
        )}

        {CALLER_ROLES.includes(role) && hasSyncDeps && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider">Resilience</h3>
            <Field label="Retries on failure" hint={cfg.retries ? `up to ${cfg.retries + 1} attempts` : "off"}>
              <Stepper value={cfg.retries} min={0} max={5} noun="retry" onChange={(retries) => set({ retries })} />
            </Field>
            <Toggle
              label="Circuit breaker"
              hint={`Stops calling a dependency that fails over half its requests, for ${BREAKER_COOLDOWN_S}s.`}
              on={cfg.circuitBreaker}
              onChange={(circuitBreaker) => set({ circuitBreaker })}
            />
          </div>
        )}

        {(kind === "cache" || kind === "cdn") && (
          <Field label="Hit rate" hint={fmtPct(cfg.hitRate * 100)}>
            <input
              type="range"
              min={0}
              max={0.99}
              step={0.01}
              value={cfg.hitRate}
              onChange={(e) => set({ hitRate: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
        )}
        {kind === "rate_limiter" && (
          <Field label="Allow up to" hint="rps, rest get 429">
            <NumberInput value={cfg.rateLimit} onChange={(rateLimit) => set({ rateLimit })} step={100} />
          </Field>
        )}
        {kind === "scheduler" && (
          <Field label="Emits" hint="jobs/sec">
            <NumberInput value={cfg.sourceRps} onChange={(sourceRps) => set({ sourceRps })} step={1} />
          </Field>
        )}

        {role !== "source" && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider">Chaos</h3>
            <Toggle label="Kill this node" danger on={cfg.down} onChange={(down) => set({ down })} />
            <Field label="Inject latency" hint={`+${cfg.extraLatencyMs}ms`}>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={cfg.extraLatencyMs}
                onChange={(e) => set({ extraLatencyMs: Number(e.target.value) })}
                className="w-full"
              />
            </Field>
          </div>
        )}

        <div className="space-y-2 border-t border-line pt-4 text-xs leading-relaxed text-ink-2">
          <p>
            <span className="font-semibold text-ink">How it routes. </span>
            {ROLE_BEHAVIOR[role]}
          </p>
          <p>{info.summary}</p>
          <p className="text-ink-3">e.g. {info.examples}</p>
        </div>
      </div>
    </div>
  );
}

export function EdgeInspector({
  edge,
  nodes,
  edges,
  onChange,
  onReverse,
  onDelete,
  onClose,
}: {
  edge: FlowEdgeType;
  nodes: ArchNodeType[];
  edges: FlowEdgeType[];
  onChange: (data: FlowEdgeType["data"]) => void;
  onReverse: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const snap = useSnapshot();
  const from = nodes.find((n) => n.id === edge.source);
  const to = nodes.find((n) => n.id === edge.target);
  if (!from || !to) return null;
  const router = ["route", "limiter"].includes(ROLE[from.data.kind]) && to.data.kind !== "cache" && ROLE[to.data.kind] !== "store";
  const sim = (n: ArchNodeType) => ({ id: n.id, kind: n.data.kind, label: n.data.label, config: resolveConfig(n.data.kind, n.data.config) });
  const siblings = edges.filter((e) => e.source === from.id).map((e) => nodes.find((n) => n.id === e.target)!).filter(Boolean).map(sim);
  const auto = autoRatio(sim(from), sim(to), siblings);
  const ratio = edge.data?.ratio;
  const m = snap?.edges[edge.id];

  return (
    <div>
      <Header
        title="Connection"
        onClose={onClose}
        onDelete={onDelete}
        icon={
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-white">
            <ArrowLeftRight size={16} />
          </span>
        }
      />
      <div className="space-y-5 p-5">
        <div className="rounded-xl bg-wash p-3 text-sm">
          <div className="font-semibold">{from.data.label}</div>
          <div className="my-1 text-xs text-ink-3">↓ requests flow to</div>
          <div className="font-semibold">{to.data.label}</div>
          {m && <div className="mt-2 text-xs tabular-nums text-ink-2">{fmtRps(m.rps)}/s right now</div>}
        </div>
        <button
          onClick={onReverse}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-2 py-2 text-sm font-medium hover:border-ink"
        >
          <ArrowLeftRight size={14} /> Reverse direction
        </button>

        <Field
          label={router ? "Traffic weight" : "Calls per request"}
          hint={ratio == null ? `auto: ${router ? 1 : +auto.toFixed(2)}` : undefined}
        >
          <NumberInput
            value={ratio ?? (router ? 1 : +auto.toFixed(2))}
            step={router ? 1 : 0.1}
            onChange={(n) => onChange({ ...edge.data, ratio: n })}
          />
        </Field>
        <p className="text-xs leading-relaxed text-ink-3">
          {router
            ? "Share of this router's traffic sent down this path, relative to its other routes, e.g. 7 reads for every 1 write."
            : auto < 1 && ratio == null
              ? "Auto uses the cache miss rate: with a cache beside it, this database only sees misses. Set 1 if every request really hits it."
              : "How many times each request calls the target. Use 0.01 for a rare call, or 200 for fan-out to followers."}
        </p>
        {ratio != null && (
          <button onClick={() => onChange({ ...edge.data, ratio: undefined })} className="text-xs font-medium underline">
            Reset to auto
          </button>
        )}

        <Field label="Label">
          <input
            value={edge.data?.label ?? ""}
            onChange={(e) => onChange({ ...edge.data, label: e.target.value || undefined })}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="e.g. read-through"
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}
