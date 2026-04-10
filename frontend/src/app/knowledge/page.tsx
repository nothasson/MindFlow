/* eslint-disable react-hooks/immutability, @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MainShell } from "@/components/layout/MainShell";
import { getKnowledgeGraph } from "@/lib/api";
import type { KnowledgeNode, KnowledgeEdge } from "@/lib/types";

interface SimNode extends KnowledgeNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "#6b8e6b"; // 柔和绿
  if (confidence >= 0.4) return "#c4a54a"; // 柔和黄
  return "#c07060"; // 柔和红
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "已掌握";
  if (confidence >= 0.4) return "学习中";
  return "薄弱";
}

export default function KnowledgePage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeNode | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    getKnowledgeGraph()
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  // Initialize simulation nodes when data changes
  useEffect(() => {
    const w = 800;
    const h = 600;
    simNodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * 300,
      y: h / 2 + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
    }));
  }, [nodes]);

  // Simple force simulation
  const tick = useCallback(() => {
    const simNodes = simNodesRef.current;
    if (simNodes.length === 0) return;

    const w = 800;
    const h = 600;
    const centerX = w / 2;
    const centerY = h / 2;

    // Build concept -> index map
    const indexMap = new Map<string, number>();
    simNodes.forEach((n, i) => indexMap.set(n.concept, i));

    // Repulsion between all nodes
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const dx = simNodes[j].x - simNodes[i].x;
        const dy = simNodes[j].y - simNodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 2000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        simNodes[i].vx -= fx;
        simNodes[i].vy -= fy;
        simNodes[j].vx += fx;
        simNodes[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const si = indexMap.get(edge.from);
      const ti = indexMap.get(edge.to);
      if (si === undefined || ti === undefined) continue;
      const dx = simNodes[ti].x - simNodes[si].x;
      const dy = simNodes[ti].y - simNodes[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.005;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      simNodes[si].vx += fx;
      simNodes[si].vy += fy;
      simNodes[ti].vx -= fx;
      simNodes[ti].vy -= fy;
    }

    // Center gravity
    for (const n of simNodes) {
      n.vx += (centerX - n.x) * 0.001;
      n.vy += (centerY - n.y) * 0.001;
    }

    // Apply velocity with damping
    for (const n of simNodes) {
      n.vx *= 0.9;
      n.vy *= 0.9;
      n.x += n.vx;
      n.y += n.vy;
      // Keep in bounds
      n.x = Math.max(40, Math.min(w - 40, n.x));
      n.y = Math.max(40, Math.min(h - 40, n.y));
    }
  }, [edges]);

  // Animation loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let running = true;
    const svg = svgRef.current;
    if (!svg) return;

    const animate = () => {
      if (!running) return;
      tick();

      const simNodes = simNodesRef.current;
      const indexMap = new Map<string, number>();
      simNodes.forEach((n, i) => indexMap.set(n.concept, i));

      // Update SVG elements
      const lines = svg.querySelectorAll<SVGLineElement>("line[data-edge]");
      lines.forEach((line) => {
        const from = line.getAttribute("data-from") ?? "";
        const to = line.getAttribute("data-to") ?? "";
        const si = indexMap.get(from);
        const ti = indexMap.get(to);
        if (si !== undefined && ti !== undefined) {
          line.setAttribute("x1", String(simNodes[si].x));
          line.setAttribute("y1", String(simNodes[si].y));
          line.setAttribute("x2", String(simNodes[ti].x));
          line.setAttribute("y2", String(simNodes[ti].y));
        }
      });

      const groups = svg.querySelectorAll<SVGGElement>("g[data-node-idx]");
      groups.forEach((g) => {
        const idx = Number(g.getAttribute("data-node-idx"));
        if (simNodes[idx]) {
          g.setAttribute("transform", `translate(${simNodes[idx].x}, ${simNodes[idx].y})`);
        }
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [nodes, tick]);

  return (
    <MainShell>
  {loading ? (
      <div className="flex h-full items-center justify-center bg-[#EEECE2]">
        <p className="text-stone-500">加载知识图谱...</p>
      </div>
  ) : error ? (
      <div className="flex h-full items-center justify-center bg-[#EEECE2]">
        <p className="text-red-600">{error}</p>
      </div>
  ) : nodes.length === 0 ? (
      <div className="flex h-full flex-col items-center justify-center bg-[#EEECE2]">
        <div className="text-center">
          <div className="mb-4 text-6xl text-stone-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <circle cx="12" cy="12" r="3" />
              <circle cx="5" cy="6" r="2" />
              <circle cx="19" cy="6" r="2" />
              <circle cx="5" cy="18" r="2" />
              <circle cx="19" cy="18" r="2" />
              <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
              <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
              <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
              <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">知识图谱</h1>
          <p className="text-sm text-stone-500">
            暂无知识点数据，开始学习后这里会显示你的知识网络。
          </p>
          <div className="mt-6 flex justify-center gap-6 text-xs text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#6b8e6b"}} />
              已掌握
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#c4a54a"}} />
              学习中
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#c07060"}} />
              薄弱
            </span>
          </div>
        </div>
      </div>
  ) : (
      <div className="relative flex h-full bg-[#EEECE2]">
      {/* Graph area */}
      <div className="flex-1">
        <div className="absolute left-4 top-4 z-10">
          <h1 className="text-lg font-semibold text-stone-800">知识图谱</h1>
          <div className="mt-2 flex gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#6b8e6b"}} />
              已掌握
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#c4a54a"}} />
              学习中
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#c07060"}} />
              薄弱
            </span>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 800 600"
          className="h-full w-full"
          style={{ minHeight: "100%" }}
        >
          {/* Edges */}
          {edges.map((e) => (
            <line
              key={e.id}
              data-edge=""
              data-from={e.from}
              data-to={e.to}
              x1={400}
              y1={300}
              x2={400}
              y2={300}
              stroke="#c8c4b8"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
          ))}
          {/* Nodes */}
          {nodes.map((n, i) => (
            <g
              key={n.id}
              data-node-idx={i}
              transform="translate(400, 300)"
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(n)}
            >
              <circle
                r={Math.max(28, 10 + n.concept.length * 5)}
                fill={confidenceColor(n.confidence)}
                fillOpacity={0.85}
                stroke={selected?.id === n.id ? "#57534e" : "#EEECE2"}
                strokeWidth={selected?.id === n.id ? 2.5 : 1.5}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                fontSize={n.concept.length > 4 ? 10 : 12}
                fill="white"
                fontWeight={600}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {n.concept.length > 5 ? n.concept.slice(0, 4) + "…" : n.concept}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-72 shrink-0 border-l border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-800">{selected.concept}</h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-stone-400">掌握度</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-stone-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.round(selected.confidence * 100)}%`,
                      backgroundColor: confidenceColor(selected.confidence),
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-stone-600">
                  {Math.round(selected.confidence * 100)}%
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: confidenceColor(selected.confidence) }}>
                {confidenceLabel(selected.confidence)}
              </p>
            </div>

            {selected.error_type && (
              <div>
                <p className="text-xs text-stone-400">常见错误类型</p>
                <p className="mt-0.5 text-stone-700">{selected.error_type}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-stone-400">复习次数</p>
              <p className="mt-0.5 text-stone-700">{selected.repetitions} 次</p>
            </div>

            <div>
              <p className="text-xs text-stone-400">复习间隔</p>
              <p className="mt-0.5 text-stone-700">{selected.interval_days} 天</p>
            </div>

            <div>
              <p className="text-xs text-stone-400">下次复习</p>
              <p className="mt-0.5 text-stone-700">
                {new Date(selected.next_review).toLocaleDateString("zh-CN")}
              </p>
            </div>

            <div>
              <p className="text-xs text-stone-400">难度因子</p>
              <p className="mt-0.5 text-stone-700">{selected.easiness_factor.toFixed(2)}</p>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/?q=${encodeURIComponent(selected.concept)}`)}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#C67A4A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a]"
            >
              开始学习「{selected.concept}」
            </button>

            {/* Related concepts */}
            {edges.filter((e) => e.from === selected.concept || e.to === selected.concept).length > 0 && (
              <div>
                <p className="text-xs text-stone-400">关联概念</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {edges
                    .filter((e) => e.from === selected.concept || e.to === selected.concept)
                    .map((e) => {
                      const related = e.from === selected.concept ? e.to : e.from;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            const node = nodes.find((n) => n.concept === related);
                            if (node) setSelected(node);
                          }}
                          className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200"
                        >
                          {related}
                          <span className="ml-1 text-stone-400">({e.relation_type})</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
  )}
    </MainShell>
  );
}
