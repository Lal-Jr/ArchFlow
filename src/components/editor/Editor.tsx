"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
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
import { SimContext, useSimulation } from "./useSimulation";

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
  /** Extra left-panel tabs, rendered after "Components" with the live graph. */
  tabs?: (g: Graph) => Tab[];
  footer?: (g: Graph) => React.ReactNode;
}

export function Editor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function EditorInner({ storageKey, initial, tabs, footer }: EditorProps) {
  const [saved] = useState(() => loadDesign(storageKey) ?? initial ?? null);
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchNodeType>(saved?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(
    (saved?.edges ?? []).map((e) => ({ ...e, ...defaultEdgeOptions })),
  );
  const [tab, setTab] = useState("components");
  // Fitting an empty canvas would re-center and zoom the moment the first node is dropped.
  const [fitOnMount] = useState(() => (saved?.nodes.length ?? 0) > 0);
  const [connecting, setConnecting] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const sim = useSimulation(nodes, edges);

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

  const graph = { nodes, edges };
  const allTabs: Tab[] = [
    { id: "components", label: "Components", content: <Palette onAdd={addAtCenter} /> },
    ...(tabs?.(graph) ?? []),
  ];
  const activeTab = allTabs.find((t) => t.id === tab) ?? allTabs[0];

  return (
    <SimContext.Provider value={sim.store}>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[288px] shrink-0 flex-col border-r border-line bg-white">
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
            <Controls position="top-left" showInteractive={false} style={{ top: 64 }} />
          </ReactFlow>
          <SimBar sim={sim} />
          <SimSheet />
          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-24">
              <div className="max-w-sm text-center">
                <p className="mb-1 text-xl font-bold tracking-tight">Start with a client.</p>
                <p className="text-sm text-ink-2">
                  Add components from the left. Hover a component and drag from the dot on its edge to connect it. Requests
                  travel the way the arrow points.
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-line bg-white">
          {selectedNode ? (
            <NodeInspector
              key={selectedNode.id}
              node={selectedNode}
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
            <InsightsPanel compiled={sim.compiled} onFocus={focusNode} />
          )}
        </aside>
      </div>
    </SimContext.Provider>
  );
}
