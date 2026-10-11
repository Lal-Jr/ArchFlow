/**
 * Endpoints: a client's traffic is a mix of named requests ("GET /feed", "POST /posts"),
 * and services can be told which of them they handle. Reads can be answered by caches;
 * writes go through them to the store. Traffic for an endpoint that nothing behind a
 * router handles is rejected there (404), so a missing binding shows up as errors.
 */

export const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
export type HttpMethod = (typeof METHODS)[number];

export interface Endpoint {
  method: HttpMethod;
  path: string;
  /** Relative share of this client's requests. */
  share: number;
}

/** The traffic class of a client with no endpoints: unlabelled reads, as before endpoints existed. */
export const ANY = "*";

export const endpointKey = (e: Pick<Endpoint, "method" | "path">) => `${e.method} ${e.path.trim() || "/"}`;

/** Everything but GET changes data, so it skips caches and always reaches the store. */
export const isWrite = (key: string) => key !== ANY && !key.startsWith("GET ");

/** A client's request mix as [key, fraction] pairs that sum to 1 (merging duplicate keys). */
export function requestMix(endpoints: Endpoint[] | undefined): [string, number][] {
  const live = (endpoints ?? []).filter((e) => e.share > 0 && Number.isFinite(e.share));
  const total = live.reduce((a, e) => a + e.share, 0);
  if (!live.length || total <= 0) return [[ANY, 1]];
  const out = new Map<string, number>();
  for (const e of live) out.set(endpointKey(e), (out.get(endpointKey(e)) ?? 0) + e.share / total);
  return [...out];
}

/** Starter mixes offered in the client inspector. */
export const MIX_PRESETS: { id: string; label: string; endpoints: Endpoint[] }[] = [
  {
    id: "read-heavy",
    label: "Read-heavy API",
    endpoints: [
      { method: "GET", path: "/items/:id", share: 90 },
      { method: "POST", path: "/items", share: 10 },
    ],
  },
  {
    id: "url-shortener",
    label: "Link redirects",
    endpoints: [
      { method: "GET", path: "/:code", share: 99 },
      { method: "POST", path: "/links", share: 1 },
    ],
  },
  {
    id: "checkout",
    label: "Store with checkout",
    endpoints: [
      { method: "GET", path: "/products", share: 80 },
      { method: "POST", path: "/cart", share: 15 },
      { method: "POST", path: "/checkout", share: 5 },
    ],
  },
];
