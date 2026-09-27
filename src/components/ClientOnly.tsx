"use client";

import dynamic from "next/dynamic";
import { getChallenge } from "@/lib/challenges";
import type { Problem } from "@/lib/problems";

// These screens restore saved designs from localStorage, so they only render on the client.
const Blank = () => <div className="flex-1 bg-canvas" />;

const Workspace = dynamic(() => import("./Workspace").then((m) => m.Workspace), { ssr: false, loading: Blank });
const ChallengeWorkspace = dynamic(() => import("./ChallengeWorkspace").then((m) => m.ChallengeWorkspace), {
  ssr: false,
  loading: Blank,
});
const Sandbox = dynamic(() => import("./Sandbox").then((m) => m.Sandbox), { ssr: false, loading: Blank });

export function WorkspaceLoader({ problem }: { problem: Problem }) {
  return <Workspace problem={problem} />;
}

export function SandboxLoader() {
  return <Sandbox />;
}

/** Takes an id: challenges hold functions (their starting design), which can't cross the server boundary. */
export function ChallengeLoader({ id }: { id: string }) {
  return <ChallengeWorkspace challenge={getChallenge(id)!} />;
}
