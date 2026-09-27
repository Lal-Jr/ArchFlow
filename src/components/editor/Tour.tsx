"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";

export interface TourStep {
  /** Matches a `data-tour` attribute on the element to spotlight. */
  target: string;
  title: string;
  body: string;
}

export const EDITOR_TOUR: TourStep[] = [
  {
    target: "palette",
    title: "Pick your building blocks",
    body: "Drag a component onto the canvas, or just click it. Start with a Client, since that's where traffic comes from.",
  },
  {
    target: "canvas",
    title: "Connect them",
    body: "Hover a component and drag from a dot on its edge to another component. The arrow shows which way requests travel.",
  },
  {
    target: "run",
    title: "Send traffic through it",
    body: "Press Run, then drag the slider or pick a pattern like Spike. Press Space any time to pause.",
  },
  {
    target: "inspector",
    title: "Tune it and break it",
    body: "Click any component to change its replicas, add retries or autoscaling, or kill it. Insights here explain what's going wrong and how to fix it.",
  },
  {
    target: "metrics",
    title: "Watch the numbers",
    body: "Throughput, latency, errors and queue depth update live. Press ? to see keyboard shortcuts.",
  },
];

const PAD = 6;
const CARD_W = 300;

/** A spotlight walkthrough: dims the page, rings the target element and explains it. */
export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  useLayoutEffect(() => {
    const measure = () => setRect(document.querySelector(`[data-tour="${step.target}"]`)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight") setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onDone]);

  // Put the card beside the target where it fits: right, then left, then below/above it.
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  let left = vw / 2 - CARD_W / 2;
  let top = vh / 2 - 90;
  if (rect) {
    if (rect.right + 16 + CARD_W < vw) left = rect.right + 16;
    else if (rect.left - 16 - CARD_W > 0) left = rect.left - 16 - CARD_W;
    else left = Math.min(vw - CARD_W - 16, Math.max(16, rect.left + rect.width / 2 - CARD_W / 2));
    top = rect.height > vh * 0.6 ? vh / 2 - 90 : rect.bottom + 16 + 200 < vh ? rect.bottom + 16 : Math.max(16, rect.top - 216);
    if (rect.right + 16 + CARD_W < vw || rect.left - 16 - CARD_W > 0) top = Math.min(vh - 220, Math.max(16, rect.top));
  }
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Guided tour">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 3px #fff, 0 0 0 9999px rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      <div className="absolute rounded-2xl bg-white p-5 shadow-2xl transition-all duration-300" style={{ left, top, width: CARD_W }}>
        <button onClick={onDone} aria-label="Close tour" className="absolute right-3 top-3 rounded-full p-1 text-ink-3 hover:bg-wash hover:text-ink">
          <X size={16} />
        </button>
        <div className="mb-1 text-xs font-medium text-ink-3">
          {i + 1} of {steps.length}
        </div>
        <h3 className="mb-1.5 text-lg font-bold tracking-tight">{step.title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-ink-2">{step.body}</p>
        <div className="flex items-center gap-2">
          <button onClick={onDone} className="text-sm font-medium text-ink-3 hover:text-ink">
            Skip
          </button>
          <div className="ml-auto flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="rounded-lg bg-wash px-3 py-2 text-sm font-medium hover:bg-line">
                Back
              </button>
            )}
            <button
              onClick={() => (last ? onDone() : setI(i + 1))}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-2"
            >
              {last ? "Start building" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
