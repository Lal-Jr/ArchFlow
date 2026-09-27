"use client";

import dynamic from "next/dynamic";
import type { Problem } from "@/lib/problems";

// Both screens restore saved designs from localStorage, so they only render on the client.
const Blank = () => <div className="flex-1 bg-canvas" />;

const Workspace = dynamic(() => import("./Workspace").then((m) => m.Workspace), { ssr: false, loading: Blank });
const Sandbox = dynamic(() => import("./Sandbox").then((m) => m.Sandbox), { ssr: false, loading: Blank });

export function WorkspaceLoader({ problem }: { problem: Problem }) {
  return <Workspace problem={problem} />;
}

export function SandboxLoader() {
  return <Sandbox />;
}
