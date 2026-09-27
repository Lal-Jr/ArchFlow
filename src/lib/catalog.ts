export type ComponentType =
  | "client"
  | "dns"
  | "cdn"
  | "load_balancer"
  | "api_gateway"
  | "service"
  | "websocket"
  | "worker"
  | "cache"
  | "sql_db"
  | "nosql_db"
  | "object_storage"
  | "queue"
  | "stream"
  | "search"
  | "rate_limiter"
  | "scheduler";

export type Category = "edge" | "compute" | "data" | "async";

export interface ComponentInfo {
  type: ComponentType;
  label: string;
  category: Category;
  examples: string;
  summary: string;
  whenToUse: string[];
  tradeoffs: string[];
}

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  edge: { label: "Edge & Networking", color: "#38bdf8" },
  compute: { label: "Compute", color: "#a78bfa" },
  data: { label: "Storage", color: "#34d399" },
  async: { label: "Async & Messaging", color: "#fbbf24" },
};

export const CATALOG: ComponentInfo[] = [
  {
    type: "client",
    label: "Client",
    category: "edge",
    examples: "Web browser, iOS / Android app",
    summary: "The user's device. Every design starts here: who is calling the system, and how often?",
    whenToUse: ["Always — it anchors the request flow", "Draw separate clients when readers and writers behave differently"],
    tradeoffs: ["Logic on the client (e.g. caching, retries) reduces server load but is harder to update"],
  },
  {
    type: "dns",
    label: "DNS",
    category: "edge",
    examples: "Route 53, Cloudflare DNS",
    summary: "Resolves a domain to IP addresses. It can also route users to the nearest region (GeoDNS).",
    whenToUse: ["Multi-region deployments", "Mentioning it briefly shows you understand the full request path"],
    tradeoffs: ["TTL caching means failover is not instant"],
  },
  {
    type: "cdn",
    label: "CDN",
    category: "edge",
    examples: "CloudFront, Akamai, Fastly",
    summary: "A geographically distributed cache for static or media content, served close to users.",
    whenToUse: ["Images, video, JS/CSS bundles", "Read-heavy, rarely changing content with global users"],
    tradeoffs: ["Cache invalidation is slow and costs money", "Not useful for personalized, dynamic responses"],
  },
  {
    type: "load_balancer",
    label: "Load Balancer",
    category: "edge",
    examples: "AWS ALB/NLB, NGINX, HAProxy",
    summary: "Spreads traffic across many stateless server instances and removes unhealthy ones.",
    whenToUse: ["Whenever you horizontally scale a service", "To get high availability (no single server is critical)"],
    tradeoffs: ["L4 is faster, L7 can route by path/header", "Sticky sessions hurt even load distribution"],
  },
  {
    type: "api_gateway",
    label: "API Gateway",
    category: "edge",
    examples: "Kong, AWS API Gateway, Envoy",
    summary: "A single entry point that handles auth, rate limiting, and routing requests to backend services.",
    whenToUse: ["Microservice architectures", "Centralizing cross-cutting concerns like auth and throttling"],
    tradeoffs: ["Extra network hop", "Can become a bottleneck or a single point of failure if not scaled"],
  },
  {
    type: "service",
    label: "App Service",
    category: "compute",
    examples: "Stateless API servers (Node, Go, Java…)",
    summary: "Stateless application servers running business logic. Scale them horizontally behind a load balancer.",
    whenToUse: ["Core request handling", "Split into multiple services when read and write paths scale differently"],
    tradeoffs: ["Keep them stateless — push state to caches and databases", "More services means more operational overhead"],
  },
  {
    type: "websocket",
    label: "WebSocket Server",
    category: "compute",
    examples: "Socket.IO, custom Go/Erlang servers",
    summary: "Holds long-lived, bidirectional connections so the server can push data to clients instantly.",
    whenToUse: ["Chat, live notifications, multiplayer, live location", "When polling would be too slow or wasteful"],
    tradeoffs: ["Stateful: you must track which server holds which user's connection", "Harder to load balance and deploy"],
  },
  {
    type: "worker",
    label: "Worker",
    category: "compute",
    examples: "Background job processors, consumers",
    summary: "Processes jobs asynchronously, off the request path, usually by consuming from a queue.",
    whenToUse: ["Slow work: transcoding, fan-out, emails, ML inference", "Anything the user doesn't need to wait for"],
    tradeoffs: ["Eventual consistency — results are not immediate", "Need retries, idempotency, dead-letter queues"],
  },
  {
    type: "cache",
    label: "Cache",
    category: "data",
    examples: "Redis, Memcached",
    summary: "In-memory key-value store for hot data. Serves reads in under a millisecond and shields the database.",
    whenToUse: ["Read-heavy workloads", "Precomputed results (feeds, counters, sessions)", "Rate limiting counters"],
    tradeoffs: ["Stale data and invalidation complexity", "Memory is expensive; choose an eviction policy (LRU)"],
  },
  {
    type: "sql_db",
    label: "SQL Database",
    category: "data",
    examples: "PostgreSQL, MySQL",
    summary: "Relational database with ACID transactions, joins, and strong consistency.",
    whenToUse: ["Structured data with relationships", "Money, bookings, inventory — anything needing transactions"],
    tradeoffs: ["Harder to scale writes horizontally (needs sharding)", "Scale reads with replicas"],
  },
  {
    type: "nosql_db",
    label: "NoSQL Database",
    category: "data",
    examples: "Cassandra, DynamoDB, MongoDB",
    summary: "Horizontally scalable key-value, wide-column, or document store built for huge volumes.",
    whenToUse: ["Massive write throughput (messages, events)", "Simple access patterns by key", "Flexible schemas"],
    tradeoffs: ["Limited joins and transactions", "Often eventually consistent; design tables around queries"],
  },
  {
    type: "object_storage",
    label: "Object Storage",
    category: "data",
    examples: "Amazon S3, GCS",
    summary: "Cheap, durable storage for large binary files (images, videos, backups).",
    whenToUse: ["Any media or large blob", "Pair it with a CDN for delivery"],
    tradeoffs: ["Higher latency than a DB", "Not for small, frequently updated records"],
  },
  {
    type: "queue",
    label: "Message Queue",
    category: "async",
    examples: "SQS, RabbitMQ",
    summary: "Buffers tasks between producers and consumers so they are decoupled and can scale independently.",
    whenToUse: ["Absorbing traffic spikes", "Handing slow work to workers", "Retrying failed jobs"],
    tradeoffs: ["Adds latency and eventual consistency", "Watch ordering and duplicate delivery"],
  },
  {
    type: "stream",
    label: "Event Stream",
    category: "async",
    examples: "Kafka, Kinesis",
    summary: "A durable, ordered, replayable log of events that many consumers can read independently.",
    whenToUse: ["Fan-out to many consumers", "Analytics and event sourcing", "High-throughput pipelines (location, clicks)"],
    tradeoffs: ["Operationally heavy", "Ordering is only guaranteed per partition"],
  },
  {
    type: "search",
    label: "Search Index",
    category: "data",
    examples: "Elasticsearch, OpenSearch",
    summary: "An inverted index for full-text search, filtering, and ranking.",
    whenToUse: ["Keyword search, autocomplete, faceted filtering", "Geo queries"],
    tradeoffs: ["A secondary copy of the data — keep it in sync (usually asynchronously)"],
  },
  {
    type: "rate_limiter",
    label: "Rate Limiter",
    category: "compute",
    examples: "Token bucket in Redis, Envoy rate limiting",
    summary: "Rejects requests that exceed a quota, protecting the system from abuse and overload.",
    whenToUse: ["Public APIs", "Login endpoints", "Protecting expensive downstream services"],
    tradeoffs: ["Distributed counters need a shared store", "Choose an algorithm: token bucket, sliding window…"],
  },
  {
    type: "scheduler",
    label: "Scheduler",
    category: "async",
    examples: "Cron, Airflow, Quartz",
    summary: "Triggers jobs on a timer: cleanups, batch jobs, reminders.",
    whenToUse: ["Periodic cleanup (expired links)", "Batch analytics", "Scheduled notifications"],
    tradeoffs: ["Must avoid double-execution when running multiple instances"],
  },
];

export const CATALOG_BY_TYPE = Object.fromEntries(CATALOG.map((c) => [c.type, c])) as Record<
  ComponentType,
  ComponentInfo
>;

export function colorFor(type: ComponentType) {
  return CATEGORY_META[CATALOG_BY_TYPE[type].category].color;
}
