import type { ComponentType } from "./catalog";
import type { NodeConfig } from "./sim/config";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface SolutionNode {
  id: string;
  type: ComponentType;
  label: string;
  /** Grid column / row — converted to pixels when rendered. */
  col: number;
  row: number;
  note: string;
  /** Simulation overrides; otherwise the component's defaults apply. */
  config?: Partial<NodeConfig>;
}

export interface SolutionEdge {
  from: string;
  to: string;
  label?: string;
  /** Calls per request (fan-out) or traffic weight (routers). See SimEdge.ratio. */
  ratio?: number;
}

export type Checkpoint =
  | {
      id: string;
      kind: "component";
      title: string;
      types: ComponentType[];
      min?: number;
      hint: string;
      why: string;
    }
  | {
      id: string;
      kind: "connection";
      title: string;
      from: ComponentType[];
      to: ComponentType[];
      hint: string;
      why: string;
    };

export interface Problem {
  slug: string;
  title: string;
  tagline: string;
  difficulty: Difficulty;
  functional: string[];
  nonFunctional: string[];
  estimates: string[];
  checkpoints: Checkpoint[];
  solution: { nodes: SolutionNode[]; edges: SolutionEdge[] };
  deepDives: { q: string; a: string }[];
}

const ENTRY: ComponentType[] = ["load_balancer", "api_gateway"];
const DB: ComponentType[] = ["sql_db", "nosql_db"];
const ASYNC: ComponentType[] = ["queue", "stream"];

export const PROBLEMS: Problem[] = [
  {
    slug: "url-shortener",
    title: "URL Shortener",
    tagline: "Design TinyURL / bit.ly",
    difficulty: "Easy",
    functional: [
      "Given a long URL, return a short unique URL",
      "Visiting the short URL redirects to the original",
      "Links can expire after a configurable time",
    ],
    nonFunctional: [
      "Redirects must be very fast (< 50 ms)",
      "Highly available — broken links are unacceptable",
      "Short codes must not be guessable in sequence",
    ],
    estimates: [
      "100M new URLs / month ≈ 40 writes/sec",
      "Read:write ratio 100:1 ≈ 4,000 redirects/sec",
      "5 years × 100M × 12 × ~500 bytes ≈ 3 TB of storage",
    ],
    checkpoints: [
      {
        id: "entry",
        kind: "connection",
        title: "Traffic enters through a load balancer",
        from: ["client"],
        to: ENTRY,
        hint: "4,000 requests/sec won't fit on one server. What spreads traffic across many?",
        why: "A load balancer lets you run many stateless URL servers and survive individual failures.",
      },
      {
        id: "db",
        kind: "component",
        title: "Durable store for code → URL mappings",
        types: DB,
        hint: "Where do the mappings live permanently?",
        why: "A key-value NoSQL store (DynamoDB, Cassandra) fits well: simple lookups by key, billions of rows, easy to scale. SQL works too at this size.",
      },
      {
        id: "cache",
        kind: "component",
        title: "Cache for hot redirects",
        types: ["cache"],
        hint: "Reads outnumber writes 100 to 1, and a few links go viral. How do you avoid hitting the DB on every click?",
        why: "Redis caching popular codes absorbs most redirect traffic (the 80/20 rule) and keeps latency low.",
      },
      {
        id: "svc-cache",
        kind: "connection",
        title: "Service reads through the cache",
        from: ["service"],
        to: ["cache"],
        hint: "Your cache exists — but who talks to it?",
        why: "Cache-aside: check Redis first, fall back to the DB on a miss, then populate the cache.",
      },
      {
        id: "svc-db",
        kind: "connection",
        title: "Service writes to the database",
        from: ["service"],
        to: DB,
        hint: "Connect your app servers to the database.",
        why: "The service persists new mappings and reads them on cache misses.",
      },
      {
        id: "kgs",
        kind: "component",
        title: "Separate key generation service",
        types: ["service"],
        min: 2,
        hint: "How do many servers generate unique short codes without colliding or coordinating on every request?",
        why: "A Key Generation Service pre-generates unique base62 keys and hands out batches, so servers never collide and codes aren't sequential.",
      },
    ],
    solution: {
      nodes: [
        { id: "c", type: "client", label: "Client", col: 0, row: 1, note: "Users create short links and click them. Clicks (reads) dominate." },
        { id: "lb", type: "load_balancer", label: "Load Balancer", col: 1, row: 1, note: "Distributes requests across stateless URL servers." },
        { id: "svc", type: "service", label: "URL Service", col: 2, row: 1, note: "POST /shorten creates a mapping; GET /{code} returns a 301/302 redirect." },
        { id: "cache", type: "cache", label: "Redis (code → URL)", col: 3, row: 0, note: "Hot codes live in memory with LRU eviction. Most redirects never touch the DB." },
        { id: "db", type: "nosql_db", label: "URL Store", col: 3, row: 2, note: "Key-value table: code (PK), long_url, created_at, expires_at." },
        { id: "kgs", type: "service", label: "Key Generation Service", col: 2, row: 3, note: "Pre-generates unique 7-char base62 codes (62⁷ ≈ 3.5 trillion) and hands them out in batches." },
        { id: "cron", type: "scheduler", label: "Expiry Cleanup", col: 4, row: 2, note: "Periodically deletes expired links (or use DB TTLs)." },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "svc" },
        { from: "svc", to: "cache", label: "read-through" },
        { from: "svc", to: "db", label: "persist / miss" },
        { from: "svc", to: "kgs", label: "get key batch", ratio: 0.01 },
        { from: "cron", to: "db", label: "purge expired" },
      ],
    },
    deepDives: [
      { q: "301 or 302 redirect?", a: "301 is cached by browsers (less load, but you lose click analytics). 302 hits your server every time, so you can count clicks." },
      { q: "Why not hash the long URL?", a: "Truncated hashes (MD5 → 7 chars) collide and need checks on every write. A counter or KGS with base62 encoding guarantees uniqueness." },
      { q: "How do you shard?", a: "Shard by short code (hash-based), since every lookup is by code. That spreads keys evenly." },
    ],
  },
  {
    slug: "rate-limiter",
    title: "Distributed Rate Limiter",
    tagline: "Throttle API clients across a fleet",
    difficulty: "Easy",
    functional: [
      "Limit each client (API key or IP) to N requests per time window",
      "Return HTTP 429 with retry information when a client is over the limit",
      "Rules can differ per endpoint and per plan tier",
    ],
    nonFunctional: [
      "Adds less than a few ms of latency",
      "Limits hold across many API server instances",
      "If the limiter fails, the API keeps working (fail open)",
    ],
    estimates: ["1M requests/sec peak across the fleet", "10M distinct API keys", "~100 bytes of counter state per key ≈ 1 GB — fits in memory"],
    checkpoints: [
      {
        id: "entry",
        kind: "connection",
        title: "Traffic enters through an LB or gateway",
        from: ["client"],
        to: ENTRY,
        hint: "Where does client traffic arrive first?",
        why: "Enforcing limits at the edge rejects abusive traffic before it consumes backend resources.",
      },
      {
        id: "rl",
        kind: "component",
        title: "Rate limiter component",
        types: ["rate_limiter", "api_gateway"],
        hint: "What actually decides allow or deny?",
        why: "It can be middleware, a sidecar, or part of an API gateway. What matters is that it sits in front of the API servers.",
      },
      {
        id: "store",
        kind: "component",
        title: "Shared counter store",
        types: ["cache"],
        hint: "With 50 API servers, each keeping its own counts, a client could get 50× the limit. Where do the counters live?",
        why: "A central Redis holds the token buckets or window counters. INCR and Lua scripts make updates atomic.",
      },
      {
        id: "rl-store",
        kind: "connection",
        title: "Limiter checks the shared store",
        from: ["rate_limiter", "api_gateway"],
        to: ["cache"],
        hint: "Connect the limiter to where the counts live.",
        why: "Each request does an atomic check-and-decrement in Redis, which takes about 1 ms.",
      },
      {
        id: "rl-svc",
        kind: "connection",
        title: "Allowed requests reach the API",
        from: ["rate_limiter", "api_gateway"],
        to: ["service"],
        hint: "What happens to requests that pass?",
        why: "Only allowed requests are forwarded; the rest get a 429 with a Retry-After header.",
      },
      {
        id: "rules",
        kind: "component",
        title: "Rules configuration store",
        types: DB,
        hint: "Free-tier users get 100/min, enterprise gets 10k/min. Where are those rules defined?",
        why: "Rules live in a DB or config service, and limiters cache them in memory and refresh periodically.",
      },
    ],
    solution: {
      nodes: [
        { id: "c", type: "client", label: "API Clients", col: 0, row: 1, note: "Identified by API key, user ID, or IP address." },
        { id: "lb", type: "load_balancer", label: "Load Balancer", col: 1, row: 1, note: "Spreads traffic across limiter and API instances." },
        { id: "rl", type: "rate_limiter", label: "Rate Limiter", col: 2, row: 1, note: "Middleware that runs the token bucket / sliding window check before forwarding." },
        { id: "redis", type: "cache", label: "Redis Counters", col: 2, row: 2.3, note: "Key: rl:{client}:{endpoint}. Atomic Lua script: refill tokens, decrement, return allowed/denied." },
        { id: "rules", type: "sql_db", label: "Rules Store", col: 2, row: -0.3, note: "Per-tier limits. Cached in limiter memory and refreshed every few seconds." },
        { id: "api", type: "service", label: "API Servers", col: 3, row: 1, note: "Only ever see traffic that passed the limiter." },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "rl" },
        { from: "rl", to: "redis", label: "check & decrement" },
        { from: "rl", to: "rules", label: "load rules", ratio: 0.001 },
        { from: "rl", to: "api", label: "allowed" },
      ],
    },
    deepDives: [
      { q: "Token bucket vs sliding window?", a: "Token bucket allows short bursts and is cheap (2 values per key). Sliding window log is exact but memory-hungry. Sliding window counter is a good middle ground." },
      { q: "Race conditions?", a: "Read-then-write from two servers can double-spend a token. Use a Redis Lua script or INCR with EXPIRE so the check is atomic." },
      { q: "Redis goes down?", a: "Fail open (allow traffic) to protect availability, possibly with a local in-memory fallback limit." },
    ],
  },
  {
    slug: "chat-app",
    title: "Chat Application",
    tagline: "Design WhatsApp / Messenger",
    difficulty: "Medium",
    functional: [
      "1:1 and group messaging in real time",
      "Messages to offline users are delivered when they reconnect",
      "Online / last-seen presence",
      "Send images and video",
    ],
    nonFunctional: ["Message delivery latency < 200 ms", "Messages are never lost", "Ordering preserved within a conversation"],
    estimates: ["500M daily active users, 40 messages/day each ≈ 230k messages/sec", "~100 bytes × 20B messages/day ≈ 2 TB/day of text", "Tens of millions of concurrent connections"],
    checkpoints: [
      {
        id: "ws",
        kind: "component",
        title: "Persistent connections (WebSockets)",
        types: ["websocket"],
        hint: "How does the server push a new message to a phone instantly without the phone polling every second?",
        why: "WebSocket servers keep a long-lived connection per online user so messages are pushed immediately.",
      },
      {
        id: "entry",
        kind: "connection",
        title: "Clients connect via a load balancer",
        from: ["client"],
        to: ENTRY,
        hint: "Millions of connections need to spread across many chat servers.",
        why: "An L4 load balancer distributes long-lived connections across the chat server fleet.",
      },
      {
        id: "db",
        kind: "component",
        title: "Message store built for heavy writes",
        types: DB,
        hint: "230k writes/sec, append-heavy, read by conversation. Which DB fits?",
        why: "A wide-column store like Cassandra or HBase: partition by conversation_id, cluster by timestamp. It handles huge write throughput.",
      },
      {
        id: "ws-db",
        kind: "connection",
        title: "Chat servers persist messages",
        from: ["websocket", "service"],
        to: DB,
        hint: "Messages must never be lost. When are they saved?",
        why: "Persist before acknowledging to the sender, so a crash never loses a message.",
      },
      {
        id: "registry",
        kind: "connection",
        title: "Session registry: which server holds which user",
        from: ["websocket", "service"],
        to: ["cache"],
        hint: "Alice is connected to server 12 and Bob to server 87. How does server 12 know where to send Bob's message?",
        why: "A Redis map of user_id → server_id (plus presence and last-seen) lets servers route messages to each other.",
      },
      {
        id: "offline",
        kind: "component",
        title: "Async path for offline delivery",
        types: ASYNC,
        hint: "Bob's phone is off. What happens to his message?",
        why: "Undelivered messages go to a queue. Workers send push notifications (APNs/FCM), and the backlog syncs on reconnect.",
      },
      {
        id: "media",
        kind: "component",
        title: "Blob storage for media",
        types: ["object_storage"],
        hint: "Should a 20 MB video travel through the chat servers and the messages DB?",
        why: "Upload media to object storage (via a media service or presigned URL) and send only the link in the message.",
      },
    ],
    solution: {
      nodes: [
        { id: "c", type: "client", label: "Mobile / Web Clients", col: 0, row: 1, note: "Hold a WebSocket open while the app is in the foreground." },
        { id: "lb", type: "load_balancer", label: "L4 Load Balancer", col: 1, row: 1, note: "Distributes long-lived TCP connections across chat servers." },
        { id: "ws", type: "websocket", label: "Chat Servers", col: 2, row: 1, note: "Stateful: each holds thousands of user connections. Receives, persists, and routes messages." },
        { id: "reg", type: "cache", label: "Session Registry", col: 3, row: 0, note: "user_id → chat server, plus presence and last-seen. Used to route messages between servers." },
        { id: "db", type: "nosql_db", label: "Messages (Cassandra)", col: 3, row: 1, note: "Partition key: conversation_id. Clustering key: message_id (time-sortable, e.g. Snowflake)." },
        { id: "q", type: "queue", label: "Offline Queue", col: 3, row: 2, note: "Messages for disconnected users wait here." },
        { id: "push", type: "worker", label: "Push Notification Workers", col: 4, row: 2, note: "Send via APNs / FCM so the phone wakes up and syncs." },
        { id: "media", type: "service", label: "Media Service", col: 2, row: 3, note: "Issues presigned upload URLs and generates thumbnails." },
        { id: "s3", type: "object_storage", label: "Media Storage", col: 3, row: 3, note: "Images and video. Messages store only a reference to them." },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "ws", label: "WebSocket" },
        { from: "ws", to: "reg", label: "lookup / presence" },
        { from: "ws", to: "db", label: "persist", ratio: 1 },
        { from: "ws", to: "q", label: "recipient offline", ratio: 0.1 },
        { from: "q", to: "push" },
        { from: "lb", to: "media", label: "HTTPS", ratio: 0.05 },
        { from: "media", to: "s3" },
      ],
    },
    deepDives: [
      { q: "How are group messages delivered?", a: "For small groups (≤ a few hundred members), fan out on write: look up each member's server and deliver. Very large groups/channels switch to members pulling messages." },
      { q: "Ordering?", a: "Use per-conversation sequence numbers or time-sortable IDs. Clients reorder by ID, and the DB clusters by it." },
      { q: "Delivery receipts (✓✓)?", a: "The recipient's client acks, the server updates status and pushes a receipt event back to the sender over their socket." },
    ],
  },
  {
    slug: "news-feed",
    title: "News Feed",
    tagline: "Design the Twitter / Instagram home timeline",
    difficulty: "Medium",
    functional: ["Users publish posts (text and images)", "Users follow other users", "The home feed shows recent posts from followed users"],
    nonFunctional: ["Feed loads in < 200 ms", "Read-heavy: feed views vastly outnumber posts", "A post can take a few seconds to appear (eventual consistency is fine)"],
    estimates: ["300M daily active users, each loads their feed ~10×/day ≈ 35k reads/sec", "~5k posts/sec", "Average user has 200 followers; celebrities have 100M+"],
    checkpoints: [
      {
        id: "entry",
        kind: "connection",
        title: "Clients enter via LB / gateway",
        from: ["client"],
        to: ENTRY,
        hint: "Where does traffic arrive first?",
        why: "Standard entry point for horizontally scaled services.",
      },
      {
        id: "split",
        kind: "component",
        title: "Separate write (post) and read (feed) services",
        types: ["service"],
        min: 2,
        hint: "Reads outnumber writes about 7:1 and have very different performance needs. Should one service do both?",
        why: "Splitting the post service and the feed service lets each scale and be optimized on its own.",
      },
      {
        id: "fanout",
        kind: "component",
        title: "Async fan-out",
        types: ASYNC,
        hint: "An author with 10k followers posts. Do you update 10k feeds before returning 'posted'?",
        why: "Publish a 'new post' event to a queue so the write returns instantly and fan-out happens in the background.",
      },
      {
        id: "workers",
        kind: "connection",
        title: "Workers consume fan-out jobs",
        from: ASYNC,
        to: ["worker", "service"],
        hint: "Something needs to process those events.",
        why: "Fan-out workers look up followers and push the post ID into each follower's timeline.",
      },
      {
        id: "feedcache",
        kind: "component",
        title: "Precomputed feed cache",
        types: ["cache"],
        hint: "Building a feed at read time means querying 200 users' posts and merging them — 35k times per second. Can you precompute it?",
        why: "Store each user's timeline as a Redis list of recent post IDs. Loading a feed becomes a single cache read.",
      },
      {
        id: "worker-cache",
        kind: "connection",
        title: "Fan-out writes into feed caches",
        from: ["worker", "service"],
        to: ["cache"],
        hint: "Where do the workers put the post IDs?",
        why: "This is 'fan-out on write' (push model): work is done at post time so reads are cheap.",
      },
      {
        id: "cdn",
        kind: "component",
        title: "CDN for media",
        types: ["cdn"],
        hint: "Images are most of the bytes users download. Where should they be served from?",
        why: "Images live in object storage and are served via a CDN near users.",
      },
    ],
    solution: {
      nodes: [
        { id: "c", type: "client", label: "Clients", col: 0, row: 2, note: "Post, follow, and scroll the home feed." },
        { id: "lb", type: "load_balancer", label: "Load Balancer", col: 1, row: 2, note: "Routes /posts to the post service and /feed to the feed service." },
        { id: "post", type: "service", label: "Post Service", col: 2, row: 1, note: "Write path: stores the post, then publishes a PostCreated event." },
        { id: "feed", type: "service", label: "Feed Service", col: 2, row: 3, note: "Read path: fetches post IDs from the feed cache and hydrates them with post content." },
        { id: "posts", type: "nosql_db", label: "Posts DB", col: 3, row: 0, note: "post_id, author_id, text, media_url, created_at. Sharded by post_id." },
        { id: "q", type: "stream", label: "Fan-out Stream", col: 3, row: 1, note: "Kafka topic of new-post events." },
        { id: "w", type: "worker", label: "Fan-out Workers", col: 4, row: 1, note: "For each follower, LPUSH the post ID to feed:{follower} and trim to 800 entries." },
        { id: "graph", type: "sql_db", label: "Users & Follow Graph", col: 4, row: 0, note: "follower_id / followee_id table, indexed both ways." },
        { id: "fc", type: "cache", label: "Feed Cache (Redis)", col: 3, row: 3, note: "feed:{user_id} → list of recent post IDs." },
        { id: "cdn", type: "cdn", label: "CDN", col: 1, row: 4, note: "Serves images and video from the edge." },
        { id: "s3", type: "object_storage", label: "Media Storage", col: 2, row: 4, note: "Origin for CDN content." },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "post", ratio: 1 },
        { from: "lb", to: "feed", ratio: 7 },
        { from: "post", to: "posts", label: "store" },
        { from: "post", to: "q", label: "PostCreated" },
        { from: "q", to: "w" },
        { from: "w", to: "graph", label: "get followers", ratio: 1 },
        { from: "w", to: "fc", label: "push to 200 feeds", ratio: 200 },
        { from: "feed", to: "fc", label: "read timeline" },
        { from: "feed", to: "posts", label: "hydrate", ratio: 1 },
        { from: "c", to: "cdn", label: "images" },
        { from: "cdn", to: "s3" },
      ],
    },
    deepDives: [
      { q: "The celebrity problem?", a: "Fanning out one post to 100M followers is too slow. Use a hybrid: push for normal users, pull for celebrities — merge their recent posts into the feed at read time." },
      { q: "Inactive users?", a: "Skip fan-out for users who haven't logged in recently. Build their feed on demand when they return." },
      { q: "Ranking?", a: "Fetch a few hundred candidate post IDs from the cache, then score them with a ranking service (engagement, recency, affinity) before returning." },
    ],
  },
  {
    slug: "video-streaming",
    title: "Video Streaming",
    tagline: "Design YouTube / Netflix",
    difficulty: "Hard",
    functional: ["Upload videos", "Stream video smoothly on any device and network", "Search videos by title", "View counts and metadata"],
    nonFunctional: ["Smooth playback worldwide (adaptive bitrate)", "Uploads can take minutes to process", "Very high availability for viewing"],
    estimates: ["500 hours of video uploaded per minute", "1B views/day ≈ 12k starts/sec, with huge egress bandwidth", "Each video is stored in ~5 resolutions (5× storage)"],
    checkpoints: [
      {
        id: "blob",
        kind: "component",
        title: "Object storage for video files",
        types: ["object_storage"],
        hint: "Where do petabytes of video files live?",
        why: "S3-style object storage: cheap, durable, and effectively unlimited. Never put video in a database.",
      },
      {
        id: "async",
        kind: "component",
        title: "Queue for transcoding jobs",
        types: ASYNC,
        hint: "Transcoding a 1-hour video takes minutes. Should the upload request wait for it?",
        why: "The upload service enqueues a job and returns, and processing happens asynchronously.",
      },
      {
        id: "q-worker",
        kind: "connection",
        title: "Transcoding workers consume the queue",
        from: ASYNC,
        to: ["worker"],
        hint: "What processes the transcoding jobs?",
        why: "A worker fleet (often GPU) encodes each video into multiple resolutions and codecs, split into short segments for HLS/DASH.",
      },
      {
        id: "worker-blob",
        kind: "connection",
        title: "Workers write encoded output to storage",
        from: ["worker"],
        to: ["object_storage"],
        hint: "Where do the 240p–4K renditions go?",
        why: "Encoded segments and manifests are written back to object storage, ready for delivery.",
      },
      {
        id: "cdn",
        kind: "component",
        title: "CDN for delivery",
        types: ["cdn"],
        hint: "Streaming petabytes a day from one region would be slow and ruinously expensive. How do you get bytes close to viewers?",
        why: "The CDN caches video segments at the edge. Popular videos are almost entirely served from the CDN.",
      },
      {
        id: "cdn-blob",
        kind: "connection",
        title: "CDN pulls from origin storage",
        from: ["cdn"],
        to: ["object_storage"],
        hint: "Where does the CDN get content on a cache miss?",
        why: "Object storage is the CDN's origin. Edge servers fetch segments on first request and cache them.",
      },
      {
        id: "meta",
        kind: "component",
        title: "Metadata database",
        types: DB,
        hint: "Titles, owners, processing status, view counts — where do these live?",
        why: "A relational DB (sharded) or NoSQL store holds video metadata, separate from the video bytes.",
      },
    ],
    solution: {
      nodes: [
        { id: "c", type: "client", label: "Clients", col: 0, row: 2, note: "Upload through the API, and stream segments from the CDN." },
        { id: "lb", type: "load_balancer", label: "Load Balancer", col: 1, row: 1.5, note: "Front door for API calls (not video bytes)." },
        { id: "up", type: "service", label: "Upload Service", col: 2, row: 0.5, note: "Issues resumable / presigned upload URLs and records the video as 'processing'." },
        { id: "raw", type: "object_storage", label: "Raw Uploads", col: 3, row: -0.3, note: "Original files, uploaded in chunks." },
        { id: "q", type: "queue", label: "Transcode Queue", col: 3, row: 1, note: "One job per video, split into per-chunk jobs for parallelism." },
        { id: "tx", type: "worker", label: "Transcoders", col: 4, row: 1, note: "Encode to 240p–4K in H.264/VP9/AV1, split into ~4 s segments with an HLS/DASH manifest.", config: { replicas: 20, capacity: 2, latencyMs: 30_000 } },
        { id: "enc", type: "object_storage", label: "Encoded Videos", col: 5, row: 1.8, note: "Segments and manifests. Origin for the CDN." },
        { id: "vs", type: "service", label: "Video Service", col: 2, row: 2.6, note: "Video pages: metadata, manifest URL, recommendations." },
        { id: "cache", type: "cache", label: "Metadata Cache", col: 3, row: 2.2, note: "Hot video metadata." },
        { id: "db", type: "sql_db", label: "Video Metadata", col: 4, row: 2.9, note: "video_id, owner, title, status, renditions. Sharded by video_id." },
        { id: "search", type: "search", label: "Search Index", col: 3, row: 3.5, note: "Elasticsearch over titles, tags, and descriptions." },
        { id: "cdn", type: "cdn", label: "CDN", col: 1, row: 4.2, note: "Serves video segments from the edge. The player switches bitrate as bandwidth changes." },
      ],
      edges: [
        { from: "c", to: "lb" },
        { from: "lb", to: "up", ratio: 0.02 },
        { from: "up", to: "raw", label: "upload chunks" },
        { from: "up", to: "q", label: "enqueue job" },
        { from: "q", to: "tx" },
        { from: "tx", to: "raw", label: "read" },
        { from: "tx", to: "enc", label: "5 renditions", ratio: 5 },
        { from: "tx", to: "db", label: "mark ready" },
        { from: "lb", to: "vs" },
        { from: "vs", to: "cache" },
        { from: "vs", to: "db" },
        { from: "vs", to: "search", ratio: 0.1 },
        { from: "c", to: "cdn", label: "stream segments" },
        { from: "cdn", to: "enc", label: "cache miss" },
      ],
    },
    deepDives: [
      { q: "Adaptive bitrate streaming?", a: "Video is cut into small segments at multiple bitrates. The manifest lists them, and the player picks a quality per segment based on measured bandwidth." },
      { q: "Speeding up transcoding?", a: "Split the video into chunks and transcode them in parallel across many workers (a DAG of tasks), then stitch the manifests together." },
      { q: "View counts at scale?", a: "Don't UPDATE a row on every view. Stream view events to Kafka, aggregate them in batches, and write periodically." },
    ],
  },
  {
    slug: "ride-sharing",
    title: "Ride Sharing",
    tagline: "Design Uber / Lyft",
    difficulty: "Hard",
    functional: ["Riders request a ride from their location", "Nearby drivers are matched and notified", "Riders see the driver's live location", "Trip history and fares"],
    nonFunctional: ["Matching in a few seconds", "Handle a flood of location updates", "Trip and payment data must be strongly consistent"],
    estimates: ["1M active drivers sending a location every 4 s ≈ 250k updates/sec", "~100 ride requests/sec per large city", "Location data is ephemeral — only the latest position matters for matching"],
    checkpoints: [
      {
        id: "entry",
        kind: "connection",
        title: "Clients enter via gateway / LB",
        from: ["client"],
        to: ENTRY,
        hint: "Where do rider and driver apps connect?",
        why: "An API gateway handles auth and routes to the matching, trip, and location services.",
      },
      {
        id: "ws",
        kind: "component",
        title: "Real-time push channel",
        types: ["websocket"],
        hint: "How do you push a ride offer to a driver, or the driver's position to a rider, in real time?",
        why: "Persistent WebSocket connections carry dispatch offers and live location both ways.",
      },
      {
        id: "stream",
        kind: "component",
        title: "Stream for location ingestion",
        types: ASYNC,
        hint: "250k location writes per second. Write them straight to a database?",
        why: "Location pings go into Kafka, which absorbs the firehose and feeds both the live geo index and analytics.",
      },
      {
        id: "geo",
        kind: "component",
        title: "In-memory geospatial index",
        types: ["cache"],
        hint: "'Find available drivers within 2 km' must take milliseconds. What data structure and store?",
        why: "Redis GEO, or geohash / quadtree cells in memory, gives fast nearby-driver queries on constantly changing positions.",
      },
      {
        id: "match-geo",
        kind: "connection",
        title: "Matching queries the geo index",
        from: ["service"],
        to: ["cache"],
        hint: "How does the matching service find candidate drivers?",
        why: "Matching queries nearby drivers, ranks them by ETA, and offers the ride to the best one.",
      },
      {
        id: "trips",
        kind: "component",
        title: "Consistent store for trips",
        types: ["sql_db"],
        hint: "A driver must not be double-booked, and fares must be exact. What kind of DB?",
        why: "A relational DB with transactions for trip state changes and payments.",
      },
    ],
    solution: {
      nodes: [
        { id: "r", type: "client", label: "Rider App", col: 0, row: 1, note: "Requests rides and watches the driver approach." },
        { id: "d", type: "client", label: "Driver App", col: 0, row: 3, note: "Sends GPS every ~4 s and receives ride offers." },
        { id: "gw", type: "api_gateway", label: "API Gateway", col: 1, row: 2, note: "Auth, rate limiting, routing." },
        { id: "m", type: "service", label: "Matching Service", col: 2, row: 1, note: "Finds nearby available drivers, ranks them by ETA, sends offers, handles accept/timeout." },
        { id: "ws", type: "websocket", label: "Realtime Gateway", col: 2, row: 3, note: "Persistent connections to drivers and riders for pings, offers, and live tracking." },
        { id: "k", type: "stream", label: "Location Stream", col: 3, row: 3, note: "Kafka topic partitioned by city or geohash." },
        { id: "loc", type: "worker", label: "Location Updater", col: 4, row: 3, note: "Consumes pings and updates the driver's position in the geo index.", config: { replicas: 4, capacity: 1_000, latencyMs: 2 } },
        { id: "geo", type: "cache", label: "Geo Index (Redis)", col: 4, row: 2, note: "GEOADD / GEOSEARCH on driver positions, sharded by region." },
        { id: "trips", type: "sql_db", label: "Trips DB", col: 3, row: 0, note: "trip_id, rider, driver, state, fare. Transactions prevent double booking." },
      ],
      edges: [
        { from: "r", to: "gw", label: "request ride" },
        { from: "d", to: "gw" },
        { from: "gw", to: "m", ratio: 1 },
        { from: "gw", to: "ws", ratio: 4 },
        { from: "ws", to: "k", label: "location pings" },
        { from: "k", to: "loc" },
        { from: "loc", to: "geo", label: "update position" },
        { from: "m", to: "geo", label: "nearby drivers" },
        { from: "m", to: "trips", label: "create trip", ratio: 1 },
        { from: "m", to: "ws", label: "dispatch offer" },
      ],
    },
    deepDives: [
      { q: "Geohash vs quadtree?", a: "Geohash maps lat/lng to a string prefix. Nearby cells share prefixes, so it's easy to shard and store in Redis. Quadtrees adapt to density but are harder to update at 250k writes/sec." },
      { q: "Preventing double assignment?", a: "Offer to one driver at a time with a short lock (a Redis SETNX with TTL on the driver ID), and commit the trip in a DB transaction when they accept." },
      { q: "Scaling across cities?", a: "Shard everything by region. Riders and drivers in Paris never need to query drivers in Tokyo." },
    ],
  },
];

export function getProblem(slug: string) {
  return PROBLEMS.find((p) => p.slug === slug);
}
