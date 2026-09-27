"use client";

import dynamic from "next/dynamic";
import type { Problem } from "@/lib/problems";

// The canvas restores saved designs from localStorage, so it only renders on the client.
const Workspace = dynamic(() => import("./Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="h-screen bg-zinc-950" />,
});

export function WorkspaceLoader({ problem }: { problem: Problem }) {
  return <Workspace problem={problem} />;
}
