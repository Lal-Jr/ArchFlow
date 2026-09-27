"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: "Simulation",
    rows: [
      [["Space"], "Run / pause traffic"],
      [["R"], "Reset the simulation"],
    ],
  },
  {
    title: "Editing",
    rows: [
      [[MOD, "Z"], "Undo"],
      [[MOD, "Shift", "Z"], "Redo"],
      [[MOD, "D"], "Duplicate the selected component"],
      [["Delete"], "Delete the selection"],
      [["Esc"], "Deselect"],
    ],
  },
  {
    title: "Canvas",
    rows: [
      [["F"], "Fit the design to the screen"],
      [["L"], "Tidy up the layout"],
      [["Shift", "drag"], "Select several components"],
      [["?"], "Show this list"],
    ],
  },
];

export function ShortcutsDialog({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Keyboard shortcuts</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-3 hover:bg-wash hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider">{g.title}</h3>
              <ul className="divide-y divide-line">
                {g.rows.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink-2">{label}</span>
                    <span className="flex gap-1">
                      {keys.map((k) => (
                        <kbd key={k} className="min-w-6 rounded-md border border-line-2 bg-wash px-1.5 py-0.5 text-center font-sans text-xs font-medium">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button onClick={onTour} className="mt-5 w-full rounded-lg bg-wash py-2.5 text-sm font-semibold hover:bg-line">
          Replay the guided tour
        </button>
      </div>
    </div>
  );
}
