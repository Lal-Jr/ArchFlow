/**
 * Shareable design links. A design is packed into compact arrays, deflated with the
 * browser's CompressionStream and base64url-encoded into the URL hash — so it never
 * reaches a server and survives being pasted anywhere.
 */
import { CATALOG_BY_TYPE, type ComponentType } from "./catalog";
import type { ArchNodeType, FlowEdgeType } from "./graph";
import { DEFAULTS, type NodeConfig } from "./sim/config";

type PackedNode = [id: string, kind: ComponentType, label: string, x: number, y: number, config?: Partial<NodeConfig>];
type PackedEdge = [source: string, target: string, sourceHandle: string | null, targetHandle: string | null, ratio?: number | null, label?: string | null];
interface Packed {
  v: 1;
  n: PackedNode[];
  e: PackedEdge[];
}

const MAX_NODES = 200;
const MAX_EDGES = 600;
const SIDES = new Set(["top", "right", "bottom", "left"]);

function toBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeDesign(g: { nodes: ArchNodeType[]; edges: FlowEdgeType[] }): Promise<string> {
  const packed: Packed = {
    v: 1,
    n: g.nodes.map((n) => {
      const p: PackedNode = [n.id, n.data.kind, n.data.label, Math.round(n.position.x), Math.round(n.position.y)];
      if (n.data.config && Object.keys(n.data.config).length) p.push(n.data.config);
      return p;
    }),
    e: g.edges.map((e) => [e.source, e.target, e.sourceHandle ?? null, e.targetHandle ?? null, e.data?.ratio ?? null, e.data?.label ?? null]),
  };
  const json = new TextEncoder().encode(JSON.stringify(packed));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Only known config keys with values of the right type survive — links come from strangers. */
function cleanConfig(raw: unknown): Partial<NodeConfig> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    const def = DEFAULTS.service[k as keyof NodeConfig];
    if (typeof def === "number" && typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    if (typeof def === "boolean" && typeof v === "boolean") out[k] = v;
  }
  return Object.keys(out).length ? (out as Partial<NodeConfig>) : undefined;
}

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : "");

/** Decodes and validates a shared design; throws on anything malformed. */
export async function decodeDesign(code: string): Promise<{ nodes: ArchNodeType[]; edges: FlowEdgeType[] }> {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw")));
  const p = JSON.parse(json) as Packed;
  if (p?.v !== 1 || !Array.isArray(p.n) || !Array.isArray(p.e)) throw new Error("Unrecognized design link");
  if (p.n.length > MAX_NODES || p.e.length > MAX_EDGES) throw new Error("Design is too large");

  const nodes: ArchNodeType[] = [];
  for (const [id, kind, label, x, y, config] of p.n) {
    if (!str(id) || !CATALOG_BY_TYPE[kind] || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid component");
    const cfg = cleanConfig(config);
    nodes.push({ id: str(id), type: "arch", position: { x, y }, data: { kind, label: str(label) || CATALOG_BY_TYPE[kind].label, ...(cfg ? { config: cfg } : {}) } });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges: FlowEdgeType[] = p.e
    .filter(([s, t]) => ids.has(s) && ids.has(t))
    .map(([s, t, sh, th, ratio, label], i) => ({
      id: `e${i}-${s}-${t}`,
      type: "flow",
      source: s,
      target: t,
      sourceHandle: SIDES.has(sh ?? "") ? sh : null,
      targetHandle: SIDES.has(th ?? "") ? th : null,
      data: {
        ...(typeof ratio === "number" && Number.isFinite(ratio) && ratio >= 0 ? { ratio } : {}),
        ...(str(label) ? { label: str(label) } : {}),
      },
    }));
  return { nodes, edges };
}

export const SHARE_PARAM = "d";
