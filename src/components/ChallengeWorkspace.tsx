"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { Challenge } from "@/lib/challenges";
import { clearDesign } from "@/lib/storage";
import { ChallengePanel } from "./ChallengePanel";
import { DifficultyBadge } from "./DifficultyBadge";
import { TopBar } from "./TopBar";
import { Editor } from "./editor/Editor";

/** The starting design, with the challenge's fixed conditions shown on the nodes too. */
function startGraph(challenge: Challenge) {
  const g = challenge.start();
  const o = challenge.overrides ?? {};
  g.nodes = g.nodes.map((n) => (o[n.id] ? { ...n, data: { ...n.data, config: { ...n.data.config, ...o[n.id] } } } : n));
  return g;
}

export function ChallengeWorkspace({ challenge }: { challenge: Challenge }) {
  const [version, setVersion] = useState(0);
  const key = `challenge-${challenge.id}`;

  const resetDesign = () => {
    if (!window.confirm("Reset to the starting design? Your changes will be lost.")) return;
    clearDesign(key);
    setVersion((v) => v + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <TopBar>
        <Link href="/challenges" className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
          <ArrowLeft size={15} /> Challenges
        </Link>
        <span className="text-white/30">/</span>
        <h1 className="font-semibold">{challenge.title}</h1>
        <DifficultyBadge difficulty={challenge.difficulty} invert />
      </TopBar>
      <Editor
        key={version}
        storageKey={key}
        initial={startGraph(challenge)}
        challenge={challenge}
        initialTab="mission"
        tabs={(_, sim) => [{ id: "mission", label: "Mission", content: <ChallengePanel challenge={challenge} sim={sim} /> }]}
        footer={() => (
          <button
            onClick={resetDesign}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-wash py-2.5 text-sm font-medium text-ink-2 hover:bg-line hover:text-ink"
          >
            <RotateCcw size={14} /> Reset to starting design
          </button>
        )}
      />
    </div>
  );
}
