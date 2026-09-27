/** Content for the /guide page: the interview framework, a concepts primer and the FAQ. */

export const FRAMEWORK: { step: string; minutes: string; goal: string; do: string[]; say: string }[] = [
  {
    step: "Clarify requirements",
    minutes: "5 min",
    goal: "Agree on what you're building before you build it.",
    do: [
      "List 3–5 core features (functional requirements) and explicitly park the rest",
      "Ask about scale, latency, consistency and availability (non-functional requirements)",
      "Confirm who the users are and the main flows",
    ],
    say: "Before I design anything, let me confirm scope. I'll focus on posting and the home feed, and leave out search and ads. Does that match what you want?",
  },
  {
    step: "Estimate the scale",
    minutes: "3–5 min",
    goal: "Get order-of-magnitude numbers that drive the design.",
    do: [
      "Requests per second (average and peak), and the read:write ratio",
      "Storage per year, and whether the hot set fits in memory",
      "Bandwidth for media-heavy systems",
    ],
    say: "100M daily users at 10 reads each is about 12k reads a second, with peaks around 3×. Reads dominate, so caching matters a lot.",
  },
  {
    step: "Define the API",
    minutes: "3–5 min",
    goal: "Pin down the contract the system must support.",
    do: ["Write the 3–5 key endpoints with inputs and outputs", "Mention pagination, idempotency keys and auth where they matter"],
    say: "POST /posts returns a post ID. GET /feed?cursor= returns a page of post IDs with a next cursor.",
  },
  {
    step: "Sketch the data model",
    minutes: "3–5 min",
    goal: "Choose stores by access pattern.",
    do: ["List the main entities and how they're queried", "Pick SQL vs NoSQL vs cache vs object storage per entity, and say why"],
    say: "Messages are append-heavy and read by conversation, so a wide-column store partitioned by conversation ID fits.",
  },
  {
    step: "Draw the high-level design",
    minutes: "10–15 min",
    goal: "A working end-to-end design for the core flows.",
    do: [
      "Start from the client and follow each request through the system",
      "Add load balancers, services, caches, queues and databases only when a requirement calls for them",
      "Walk through one read and one write end to end",
    ],
    say: "A post goes through the load balancer to the post service, which writes to the posts table and publishes an event. Fan-out workers push the ID into followers' feed caches.",
  },
  {
    step: "Deep dive and scale",
    minutes: "10–15 min",
    goal: "Show depth where it matters most for this problem.",
    do: [
      "Find the bottleneck (the hottest path, the biggest table, the riskiest failure)",
      "Discuss sharding, replication, caching strategy, consistency, and what happens when components fail",
      "State tradeoffs out loud — there's rarely one right answer",
    ],
    say: "The celebrity problem breaks fan-out on write, so I'd use a hybrid: push for normal users, pull for accounts over a million followers.",
  },
  {
    step: "Wrap up",
    minutes: "2–3 min",
    goal: "Leave a clear picture and show judgment.",
    do: ["Summarize the design and its key tradeoffs", "Mention monitoring, alerts and what you'd build next"],
    say: "To summarize: fan-out on write with a celebrity exception, Redis timelines, and Cassandra for posts. Next I'd add ranking and look at hot shards.",
  },
];

export const CONCEPTS: { name: string; what: string; when: string; tradeoff: string }[] = [
  {
    name: "Horizontal vs vertical scaling",
    what: "Vertical: a bigger machine. Horizontal: more machines behind a load balancer.",
    when: "Stateless services scale horizontally; databases often start vertical, then shard.",
    tradeoff: "Horizontal scaling needs stateless services and brings coordination costs; vertical scaling hits a hard ceiling and is a single point of failure.",
  },
  {
    name: "Load balancing",
    what: "Spreading requests across replicas (round robin, least connections, consistent hashing).",
    when: "Whenever you run more than one instance of something.",
    tradeoff: "L7 can route by path and header but costs more CPU than L4. Sticky sessions hurt even distribution.",
  },
  {
    name: "Caching",
    what: "Keeping hot data in memory (Redis, CDN, browser) to skip slow work.",
    when: "Read-heavy data with skewed popularity, and expensive computations.",
    tradeoff: "Staleness and invalidation. Cache-aside is simplest; write-through keeps the cache fresh at the cost of write latency.",
  },
  {
    name: "CDN",
    what: "Geographically distributed caches for static and media content.",
    when: "Images, video, JS and CSS, and any public content read worldwide.",
    tradeoff: "Great for static content; little help for personalized responses, and invalidation takes time.",
  },
  {
    name: "SQL vs NoSQL",
    what: "Relational (transactions, joins, schemas) vs key-value, document or wide-column stores built for scale.",
    when: "SQL for relationships and money; NoSQL for huge volumes with simple access patterns.",
    tradeoff: "SQL is harder to scale writes horizontally; NoSQL gives up joins and often strong consistency.",
  },
  {
    name: "Sharding (partitioning)",
    what: "Splitting data across machines by a key (hash or range).",
    when: "When one database can't hold the data or handle the writes.",
    tradeoff: "Cross-shard queries and transactions get hard, and a bad key creates hot shards.",
  },
  {
    name: "Replication",
    what: "Keeping copies of data on several nodes (leader-follower, multi-leader, leaderless).",
    when: "Availability, durability and scaling reads.",
    tradeoff: "Async replication means followers lag behind (stale reads); sync replication slows writes.",
  },
  {
    name: "Consistency models & CAP",
    what: "During a network partition you choose consistency (refuse or delay) or availability (answer, maybe stale).",
    when: "Money, inventory and locks need strong consistency; feeds, likes and counts can be eventual.",
    tradeoff: "Stronger consistency costs latency and availability. Say which parts need which.",
  },
  {
    name: "Message queues & streams",
    what: "Buffers between producers and consumers (SQS, RabbitMQ) or durable, replayable logs (Kafka).",
    when: "Slow work off the request path, absorbing spikes, fan-out to several consumers.",
    tradeoff: "Eventual consistency, plus duplicates and ordering to handle.",
  },
  {
    name: "Idempotency",
    what: "Doing an operation twice has the same effect as doing it once (e.g. via idempotency keys).",
    when: "Retries, payments, anything processed from a queue.",
    tradeoff: "Needs a dedupe store and careful key design, but it's what makes retries safe.",
  },
  {
    name: "Rate limiting",
    what: "Capping requests per client per window (token bucket, sliding window).",
    when: "Public APIs, login, protecting expensive downstream services.",
    tradeoff: "Distributed limits need a shared store; limits that are too strict hurt real users.",
  },
  {
    name: "Retries, backoff & circuit breakers",
    what: "Retrying transient failures with exponential backoff, and stopping calls to a failing dependency.",
    when: "Every network call to another service.",
    tradeoff: "Retries without backoff cause retry storms. Breakers fail fast, trading errors for stability.",
  },
  {
    name: "Consistent hashing",
    what: "Mapping keys onto a ring so adding or removing a node moves only about 1/N of the keys.",
    when: "Distributed caches, sharded stores, load balancing with affinity.",
    tradeoff: "Needs virtual nodes for even load, and more complexity than hash % N.",
  },
  {
    name: "WebSockets, SSE & long polling",
    what: "Ways for the server to push data to clients in real time.",
    when: "Chat, live updates, collaboration, location tracking.",
    tradeoff: "Persistent connections are stateful, which is harder to load balance and deploy. SSE is simpler if data flows one way.",
  },
  {
    name: "Geospatial indexing",
    what: "Geohash, quadtrees or S2 cells that turn 'what's nearby' into cheap lookups.",
    when: "Maps, ride sharing, delivery, proximity search.",
    tradeoff: "Cell size vs precision; points near cell edges need neighboring cells too.",
  },
  {
    name: "Latency percentiles (p50, p99)",
    what: "p99 is the latency 99% of requests beat — the tail your slowest users feel.",
    when: "Setting SLOs and judging real user experience.",
    tradeoff: "Averages hide the tail, and one slow dependency dominates p99 in fan-out systems.",
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQ: { group: string; items: Faq[] }[] = [
  {
    group: "Getting started",
    items: [
      { q: "What is ArchFlow for?", a: "Learning system design by doing it: draw an architecture, push simulated traffic through it, and see where it breaks. It's built for interview prep, and for anyone who wants to understand why caches, queues and replicas exist." },
      { q: "Where should I start?", a: "Open the Simulator and follow the guided tour. Then pick an Easy interview problem (URL Shortener or Pastebin), read its Guide, and try Practice mode. When you're comfortable, take a Challenge." },
      { q: "Do I need an account? Where is my work saved?", a: "No account is needed. Designs, scores and challenge results are saved in your browser's local storage. Clearing site data removes them, so share a link if you want a copy elsewhere." },
      { q: "Can I use it on my phone?", a: "The editor is designed for a desktop or laptop screen. The guides and problem pages read fine on a phone." },
    ],
  },
  {
    group: "Building designs",
    items: [
      { q: "How do I connect two components?", a: "Hover a component and drag from one of the dots on its edge to another component. You can also click a dot, then click the target." },
      { q: "Which way should arrows point?", a: "In the direction requests travel: Client → Load Balancer → Service → Database. If a component never lights up when you run traffic, check its arrows." },
      { q: "What do the numbers on a connection mean?", a: "For routers (load balancers, gateways) it's a traffic weight: 7 vs 1 sends 7 reads for every write. For services it's calls per request: 0.01 is a rare call, 200 is fan-out to 200 followers. Click a connection to set it." },
      { q: "Why does a database next to a cache get less traffic?", a: "That's cache-aside: the simulator assumes the service checks the cache first, so the database only sees misses (20% at an 80% hit rate). Set the connection ratio to 1 if every request really hits the database." },
      { q: "I made a mistake. Can I undo it?", a: "Yes: ⌘/Ctrl+Z to undo and ⌘/Ctrl+Shift+Z to redo, or use the buttons in the canvas toolbar. Press ? to see every shortcut." },
      { q: "My diagram is messy.", a: "Press L (or the grid button in the toolbar) to tidy it into a left-to-right layout." },
    ],
  },
  {
    group: "The simulation",
    items: [
      { q: "How accurate is the simulation?", a: "It's a rate-based model: it tracks requests per second, capacity, queueing and failures, not individual requests. That's accurate enough to show real failure modes (bottlenecks, retry storms, queue buildup), but it isn't a benchmark for your production system." },
      { q: "Why did my component turn red?", a: "It's overloaded: more requests arrive than its replicas can handle, so work queues up and eventually times out. Add replicas, put a cache in front of it, or reduce the load reaching it. The insights panel tells you how many replicas would fix it." },
      { q: "What's the difference between average latency and p99?", a: "Average is the typical request. p99 is the latency 99% of requests beat, so it's what your unluckiest users feel. Cache misses and slow dependencies show up in p99 long before the average moves." },
      { q: "Why does latency shoot up before a component is at 100%?", a: "Queueing. As utilization climbs past about 75%, requests increasingly wait behind each other. That's why real systems run at 60–70% and keep headroom." },
      { q: "What do retries and circuit breakers do here?", a: "Retries resend failed calls, which helps with blips but multiplies load on a struggling dependency (a retry storm). A circuit breaker stops calling a dependency that fails more than half its requests for 5 seconds, failing fast so it can recover." },
      { q: "Why doesn't autoscaling fix a spike immediately?", a: "New replicas take 10 seconds to provision, like real cloud instances. Spikes shorter than that have to be absorbed by existing capacity or a queue." },
      { q: "How is cost calculated?", a: "Each replica has a rough monthly price (for example, $70 for an app server and $350 for a SQL database). It's meant for comparing designs, not quoting a cloud bill." },
    ],
  },
  {
    group: "Interview practice",
    items: [
      { q: "How does grading work?", a: "Each problem has a list of key ideas an interviewer looks for, such as 'a cache for hot reads' or 'async fan-out'. Check my design shows which you've covered. Missing ideas show a hint first, and you choose when to reveal the answer." },
      { q: "Is the reference solution the only right answer?", a: "No. System design has many valid answers. The grader checks for key ideas, not an exact diagram, and the Guide explains the reasoning so you can defend your own choices." },
      { q: "Which companies ask these questions?", a: "Where public interview guides report a question at a company, it's shown as 'Reported at'. We only list sourced attributions, and most questions come up at many companies." },
      { q: "How should I practice for a real interview?", a: "Time yourself for 45 minutes. Say requirements and estimates out loud, draw the design in Practice, run traffic at your estimated load, then compare with the Guide's key decisions and follow-up questions." },
      { q: "What if I don't know a component?", a: "Open the Glossary: every component has what it does, when to use it, its tradeoffs, and how the simulator models it. Hover components in the palette for a one-line summary." },
    ],
  },
  {
    group: "Challenges & sharing",
    items: [
      { q: "Why can't I change capacity in a challenge?", a: "Challenges test architecture, not bigger numbers. Per-replica specs and chaos are fixed, but replicas, new components, caches, queues, autoscaling, retries and breakers are all yours." },
      { q: "How are challenges scored?", a: "Error rate over the whole run, worst p99 latency after a 5-second warm-up, peak monthly cost, and for some challenges the queue backlog at the end. Pass all the goals to win, then try to do it cheaper." },
      { q: "How do I share a design?", a: "In the Simulator, click Share design. The link contains the entire design, and there's no server involved. Anyone who opens it gets your exact setup, and their own sandbox is backed up first." },
    ],
  },
];
