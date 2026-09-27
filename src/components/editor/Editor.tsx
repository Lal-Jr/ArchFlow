"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  ControlButton,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { CATALOG_BY_TYPE, type ComponentType } from "@/lib/catalog";
import type { ArchNodeData, ArchNodeType, FlowEdgeType } from "@/lib/graph";
import { loadDesign, saveDesign } from "@/lib/storage";
import { nodeTypes } from "./ArchNode";
import { edgeTypes } from "./FlowEdge";
import { EdgeInspector, NodeInspector } from "./Inspector";
import { DND_TYPE, Palette } from "./Palette";
import { InsightsPanel, SimBar, SimSheet } from "./SimPanels";
import { SimContext, useSimulation, type Simulation } from "./useSimulation";
import type { Challenge } from "@/lib/challenges";
import type { ReviewRequest } from "@/lib/review";
import { ReviewPanel } from "./ReviewPanel";
import { Keyboard, LayoutGrid, Redo2, Undo2 } from "lucide-react";
import { tidyLayout } from "@/lib/layout";
import { MOD, ShortcutsDialog } from "./ShortcutsDialog";
import { EDITOR_TOUR, Tour } from "./Tour";
import { useHistory } from "./useHistory";

const TOUR_KEY = "archflow:tour-done";
const tourSeen = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
};

export interface Graph {
  nodes: ArchNodeType[];
  edges: FlowEdgeType[];
}
export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export const defaultEdgeOptions = {
  type: "flow" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#8f8f8f" },
};

interface EditorProps {
  storageKey: string;
  initial?: Graph;
  /** Extra left-panel tabs, rendered after "Components" with the live graph and simulation. */
  tabs?: (g: Graph, sim: Simulation) => Tab[];
  initialTab?: string;
  footer?: (g: Graph) => React.ReactNode;
  /** Challenge mode: fixed traffic and duration, locked component physics. */
  challenge?: Challenge;
  /** What the design is for — sent with AI reviews. */
  reviewContext?: ReviewRequest["context"];
}

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({ storageKey, initial, tabs, initialTab, footer, challenge, reviewContext }: EditorProps) {
  const [saved] = useState(() => loadDesign(storageKey) ?? initial ?? null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeType>(saved?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(
    (saved?.edges ?? []).map((e) => ({ ...e, ...defaultEdgeOptions })),
  );
  const [tab, setTab] = useState(initialTab ?? "components");
  // Fitting an empty canvas would re-center and zoom the moment the first node is dropped.
  const [fitOnMount] = useState(() => (saved?.nodes.length ?? 0) > 0);
  const [connecting, setConnecting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const sim = useSimulation(nodes, edges, challenge);
  const [showTour, setShowTour] = useState(() => !tourSeen());
  const [showKeys, setShowKeys] = useState(false);
  const endTour = useCallback(() => {
    setShowTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
  }, []);

  const history = useHistory(
    nodes,
    edges,
    useCallback(
      (f: Graph) => {
        setNodes(f.nodes);
        setEdges(f.edges.map((e) => ({ ...e, ...defaultEdgeOptions })));
      },
      [setNodes, setEdges],
    ),
  );

  useEffect(() => {
    saveDesign(storageKey, { nodes, edges });
  }, [storageKey, nodes, edges]);

  const addNode = useCallback(
    (kind: ComponentType, position: { x: number; y: number }) => {
      const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id, type: "arch", position, selected: true, data: { kind, label: CATALOG_BY_TYPE[kind].label } },
      ]);
      setEdges((es) => es.map((e) => ({ ...e, selected: false })));
    },
    [setNodes, setEdges],
  );

  const addAtCenter = (kind: ComponentType) => {
    const canvas = document.querySelector(".react-flow")?.getBoundingClientRect();
    const p = screenToFlowPosition({
      x: canvas ? canvas.left + canvas.width / 2 : window.innerWidth / 2,
      y: canvas ? canvas.top + canvas.height * 0.4 : window.innerHeight / 2,
    });
    const base = { x: p.x - 104, y: p.y - 30 };
    const free = (x: number, y: number) =>
      !nodes.some((n) => Math.abs(n.position.x - x) < 230 && Math.abs(n.position.y - y) < 90);
    // Search outward in rings around the viewport center for the first free grid slot.
    for (let ring = 0; ring < 6; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = base.x + dx * 250;
          const y = base.y + dy * 110;
          if (free(x, y)) return addNode(kind, { x, y });
        }
      }
    }
    addNode(kind, base);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData(DND_TYPE) as ComponentType;
    if (!kind) return;
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(kind, { x: p.x - 104, y: p.y - 30 });
  };

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, ...defaultEdgeOptions, data: {} }, es)),
    [setEdges],
  );

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = selectedNode ? undefined : edges.find((e) => e.selected);
  const clearSelection = () => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    setEdges((es) => es.map((e) => ({ ...e, selected: false })));
  };
  const focusNode = (id: string) => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
    fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.1 });
  };
  const updateNode = (id: string, data: Partial<ArchNodeData>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  };

  /** Copies the selected components (and the connections between them), offset so they're visible. */
  const duplicate = () => {
    const picked = nodes.filter((n) => n.selected);
    if (!picked.length) return;
    const stamp = Date.now().toString(36);
    const ids = new Map(picked.map((n, i) => [n.id, `${n.id}-copy-${stamp}${i}`]));
    const copies = picked.map((n) => ({
      ...n,
      id: ids.get(n.id)!,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: true,
      data: { ...n.data, label: `${n.data.label} copy`, config: n.data.config ? { ...n.data.config } : undefined },
    }));
    const links = edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ ...e, id: `${e.id}-copy-${stamp}`, source: ids.get(e.source)!, target: ids.get(e.target)!, selected: false }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...copies]);
    setEdges((es) => [...es, ...links]);
  };

  const tidy = () => {
    const pos = tidyLayout(sim.compiled, Object.fromEntries(nodes.map((n) => [n.id, n.position.y])));
    setNodes((ns) => ns.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)));
    setTimeout(() => fitView({ duration: 400, maxZoom: 1, padding: { top: 0.2, bottom: 0.55, left: 0.1, right: 0.1 } }), 30);
  };

  // Keyboard shortcuts — ignored while typing in a field or when a dialog is open.
  const keys = { undo: history.undo, redo: history.redo, duplicate, tidy, toggle: sim.toggle, reset: sim.reset, clearSelection, fitView };
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = keysRef.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) k.redo();
        else k.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        k.redo();
      } else if (mod && key === "d") {
        e.preventDefault();
        k.duplicate();
      } else if (mod || e.altKey) {
        return;
      } else if (e.key === " ") {
        e.preventDefault();
        k.toggle();
      } else if (key === "r") k.reset();
      else if (key === "f") k.fitView({ duration: 400, maxZoom: 1, padding: { top: 0.2, bottom: 0.55, left: 0.1, right: 0.1 } });
      else if (key === "l") k.tidy();
      else if (e.key === "?") setShowKeys(true);
      else if (e.key === "Escape") k.clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const graph = { nodes, edges };
  const allTabs: Tab[] = [
    { id: "components", label: "Components", content: <Palette onAdd={addAtCenter} /> },
    ...(tabs?.(graph, sim) ?? []),
  ];
  const activeTab = allTabs.find((t) => t.id === tab) ?? allTabs[0];

  return (
    <SimContext.Provider value={sim.store}>
      <div className="flex min-h-0 flex-1">
        <aside data-tour="palette" className="flex w-[288px] shrink-0 flex-col border-r border-line bg-white">
          {allTabs.length > 1 && (
            <div className="p-3 pb-0">
              <div className="flex rounded-full bg-wash p-1">
                {allTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${
                      activeTab.id === t.id ? "bg-white shadow-sm" : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{activeTab.content}</div>
          {footer && <div className="border-t border-line p-3">{footer(graph)}</div>}
        </aside>

        <div
          data-tour="canvas"
          className={`relative min-w-0 flex-1 bg-canvas ${connecting ? "af-connecting" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={() => setConnecting(true)}
            onConnectEnd={() => setConnecting(false)}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={36}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView={fitOnMount}
            fitViewOptions={{ maxZoom: 1, padding: { top: 0.2, bottom: 0.55, left: 0.1, right: 0.1 } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Lines} gap={48} color="#e4e4e4" />
            <Controls position="top-left" showInteractive={false} style={{ top: 64 }}>
              <ControlButton onClick={history.undo} disabled={!history.canUndo} title={`Undo (${MOD}Z)`} aria-label="Undo">
                <Undo2 size={14} />
              </ControlButton>
              <ControlButton onClick={history.redo} disabled={!history.canRedo} title={`Redo (${MOD}⇧Z)`} aria-label="Redo">
                <Redo2 size={14} />
              </ControlButton>
              <ControlButton onClick={tidy} disabled={nodes.length < 2} title="Tidy up the layout (L)" aria-label="Tidy up the layout">
                <LayoutGrid size={14} />
              </ControlButton>
              <ControlButton onClick={() => setShowKeys(true)} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
                <Keyboard size={14} />
              </ControlButton>
            </Controls>
          </ReactFlow>
          <SimBar sim={sim} />
          <SimSheet />
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-24">
              <div className="max-w-sm text-center">
                <p className="mb-1 text-xl font-bold tracking-tight">Start with a client.</p>
                <p className="mb-5 text-sm text-ink-2">
                  Add components from the left. Hover a component and drag from the dot on its edge to connect it. Requests
                  travel the way the arrow points.
                </p>
                <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => addAtCenter("client")}
                    className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-2"
                  >
                    Add a client
                  </button>
                  {allTabs.some((t) => t.id === "templates") && (
                    <button onClick={() => setTab("templates")} className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-wash">
                      Start from a template
                    </button>
                  )}
                  <button onClick={() => setShowTour(true)} className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-wash">
                    Show me around
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside data-tour="inspector" className="w-[340px] shrink-0 overflow-y-auto border-l border-line bg-white">
          {selectedNode ? (
            <NodeInspector
              key={selectedNode.id}
              node={selectedNode}
              locked={!!challenge}
              hasSyncDeps={edges.some(
                (e) => e.source === selectedNode.id && !["queue", "stream"].includes(nodes.find((n) => n.id === e.target)?.data.kind ?? ""),
              )}
              onChange={(d) => updateNode(selectedNode.id, d)}
              onDelete={() => deleteNode(selectedNode.id)}
              onClose={clearSelection}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              key={selectedEdge.id}
              edge={selectedEdge}
              nodes={nodes}
              edges={edges}
              onChange={(data) => setEdges((es) => es.map((e) => (e.id === selectedEdge.id ? { ...e, data } : e)))}
              onReverse={() =>
                setEdges((es) =>
                  es.map((e) =>
                    e.id === selectedEdge.id
                      ? { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle }
                      : e,
                  ),
                )
              }
              onDelete={() => setEdges((es) => es.filter((e) => e.id !== selectedEdge.id))}
              onClose={clearSelection}
            />
          ) : (
            <div hidden={!reviewing}>
              {/* Kept mounted while hidden so a finished review survives a trip back to the insights. */}
              <ReviewPanel
                nodes={nodes}
                edges={edges}
                compiled={sim.compiled}
                context={
                  reviewContext ??
                  (challenge
                    ? { kind: "challenge", title: challenge.title, details: [challenge.brief] }
                    : { kind: "sandbox", title: "Free-form design", details: [] })
                }
                onBack={() => setReviewing(false)}
              />
            </div>
          )}
          {!selectedNode && !selectedEdge && !reviewing && (
            <InsightsPanel compiled={sim.compiled} onFocus={focusNode} onReview={() => setReviewing(true)} />
          )}
        </aside>
      </div>
      {showTour && <Tour steps={EDITOR_TOUR} onDone={endTour} />}
      {showKeys && (
        <ShortcutsDialog
          onClose={() => setShowKeys(false)}
          onTour={() => {
            setShowKeys(false);
            setShowTour(true);
          }}
        />
      )}
    </SimContext.Provider>
  );
}
