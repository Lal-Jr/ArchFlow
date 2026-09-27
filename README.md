# ArchFlow

Learn system design interview diagrams by drawing them.

- **Practice** — read a problem brief (requirements + back-of-envelope numbers), drag components onto a canvas, and wire them up.
- **Check my design** — your diagram is graded against the key ideas an interviewer looks for, with Socratic hints you can reveal.
- **Solution walkthrough** — step through a reference architecture one component at a time, plus deep-dive Q&A.
- **Component glossary** (`/learn`) — what each building block does, when to use it, and its tradeoffs.

Progress is saved in your browser (localStorage).

## Develop

```bash
npm install
npm run dev
```

## Adding a problem

Problems live in `src/lib/problems.ts`. Each one has:

- `checkpoints` — what the grader checks: either a component type exists (`kind: "component"`, optional `min`) or two component types are connected (`kind: "connection"`, either direction).
- `solution` — reference nodes on a grid (`col`/`row`) and edges. Node order is the walkthrough order.

Component types and glossary content are in `src/lib/catalog.ts`.
