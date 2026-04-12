/* eslint-disable react-hooks/immutability, @typescript-eslint/no-unused-vars */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MainShell } from "@/components/layout/MainShell";
import { getKnowledgeGraph, getKnowledgeSources, deleteConcept } from "@/lib/api";
import type { KnowledgeNode, KnowledgeEdge, KnowledgeSourceLink } from "@/lib/types";
import { usePromptTemplates } from "@/hooks/usePromptTemplates";

interface SimNode extends KnowledgeNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number; // 固定位置（拖拽时）
  fy?: number;
}

/** 画布变换状态 */
interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

function confidenceColor(confidence: number): string {
  if (confidence > 0.7) return "#6b9e78";  // 柔和绿
  if (confidence >= 0.3) return "#c4a54d"; // 柔和黄
  return "#c47a6c"; // 柔和红
}

function confidenceLabel(confidence: number): string {
  if (confidence > 0.7) return "已掌握";
  if (confidence >= 0.3) return "学习中";
  return "薄弱";
}

/** 计算节点半径：基础 28，每条关联边 +3，上限 55 */
function nodeRadius(concept: string, edges: KnowledgeEdge[]): number {
  const count = edges.filter((e) => e.from === concept || e.to === concept).length;
  return Math.min(55, 28 + count * 3);
}

/** 将长文字拆成多行（每行最多 maxChars 字） */
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  return lines;
}

/**
 * 基于连通分量的智能初始布局：
 * 将节点按连通分量分组，每组放在画布的不同区域，
 * 组内节点围绕组中心分布，避免一开始就完全随机
 */
function computeInitialPositions(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  w: number,
  h: number
): { x: number; y: number }[] {
  // 1. 建立邻接表
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.concept, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  // 2. BFS 找连通分量
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (visited.has(n.concept)) continue;
    const component: string[] = [];
    const queue = [n.concept];
    visited.add(n.concept);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);
      for (const neighbor of adj.get(curr) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  // 3. 排序：大分量在中心
  components.sort((a, b) => b.length - a.length);

  // 4. 分配每个分量的中心位置
  const cx = w / 2;
  const cy = h / 2;
  const positions = new Map<string, { x: number; y: number }>();
  const numComps = components.length;

  if (numComps === 1) {
    // 单个分量：围绕画布中心圆形分布
    const comp = components[0];
    const radius = Math.min(w, h) * 0.35;
    for (let i = 0; i < comp.length; i++) {
      const angle = (2 * Math.PI * i) / comp.length;
      positions.set(comp[i], {
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 30,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 30,
      });
    }
  } else {
    // 多个分量：每个分量占一块区域
    const groupRadius = Math.min(w, h) * 0.3;
    for (let gi = 0; gi < numComps; gi++) {
      const comp = components[gi];
      const groupAngle = (2 * Math.PI * gi) / numComps;
      const gcx = cx + (gi === 0 ? 0 : groupRadius * Math.cos(groupAngle));
      const gcy = cy + (gi === 0 ? 0 : groupRadius * Math.sin(groupAngle));
      const innerRadius = Math.max(60, Math.sqrt(comp.length) * 40);
      for (let i = 0; i < comp.length; i++) {
        const angle = (2 * Math.PI * i) / comp.length;
        positions.set(comp[i], {
          x: gcx + innerRadius * Math.cos(angle) + (Math.random() - 0.5) * 20,
          y: gcy + innerRadius * Math.sin(angle) + (Math.random() - 0.5) * 20,
        });
      }
    }
  }

  return nodes.map((n) => positions.get(n.concept) ?? { x: cx, y: cy });
}

export default function KnowledgePage() {
  const router = useRouter();
  const { fill } = usePromptTemplates();
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeNode | null>(null);
  const [sources, setSources] = useState<KnowledgeSourceLink[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const animRef = useRef<number>(0);

  // 拖拽状态
  const dragNodeRef = useRef<SimNode | null>(null);
  const isDraggingRef = useRef(false);

  // 画布平移缩放状态
  const transformRef = useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // 高亮选中节点 concept
  const [highlightConcept, setHighlightConcept] = useState<string | null>(null);

  // 选中知识点时加载来源关联
  useEffect(() => {
    if (!selected) {
      setSources([]);
      return;
    }
    setSourcesLoading(true);
    getKnowledgeSources(selected.concept)
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setSourcesLoading(false));
  }, [selected]);

  useEffect(() => {
    getKnowledgeGraph()
      .then((data) => {
        setNodes(data.nodes);
        setEdges(data.edges);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  // 初始化力模拟节点（使用智能布局）
  useEffect(() => {
    const canvas = canvasRef.current;
    const w = canvas?.width ?? 800;
    const h = canvas?.height ?? 600;
    const initPositions = computeInitialPositions(nodes, edges, w, h);
    simNodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: initPositions[i].x,
      y: initPositions[i].y,
      vx: 0,
      vy: 0,
    }));
  }, [nodes, edges]);

  // 力模拟 tick — 被拖拽的节点跳过位置更新
  const tick = useCallback(() => {
    const simNodes = simNodesRef.current;
    if (simNodes.length === 0) return;

    const canvas = canvasRef.current;
    const w = canvas?.width ?? 800;
    const h = canvas?.height ?? 600;
    const centerX = w / 2;
    const centerY = h / 2;

    // concept -> index 映射
    const indexMap = new Map<string, number>();
    simNodes.forEach((n, i) => indexMap.set(n.concept, i));

    // 节点数自适应参数
    const nodeCount = simNodes.length;
    const repulsionStrength = nodeCount > 50 ? 8000 : nodeCount > 20 ? 5000 : 3000;
    const idealEdgeLen = nodeCount > 50 ? 220 : nodeCount > 20 ? 180 : 150;
    const springK = 0.008;
    const centerGravity = 0.003;

    // 斥力 — 增大斥力避免节点重叠
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const dx = simNodes[j].x - simNodes[i].x;
        const dy = simNodes[j].y - simNodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // 考虑节点半径的最小安全距离
        const ri = nodeRadius(simNodes[i].concept, edges);
        const rj = nodeRadius(simNodes[j].concept, edges);
        const minDist = ri + rj + 20;
        const effectiveDist = Math.max(dist, 1);
        let force = repulsionStrength / (effectiveDist * effectiveDist);
        // 如果节点距离小于安全距离，大幅增加排斥力
        if (dist < minDist) {
          force += (minDist - dist) * 0.5;
        }
        const fx = (dx / effectiveDist) * force;
        const fy = (dy / effectiveDist) * force;
        simNodes[i].vx -= fx;
        simNodes[i].vy -= fy;
        simNodes[j].vx += fx;
        simNodes[j].vy += fy;
      }
    }

    // 引力（沿边）— 目标距离更大
    for (const edge of edges) {
      const si = indexMap.get(edge.from);
      const ti = indexMap.get(edge.to);
      if (si === undefined || ti === undefined) continue;
      const dx = simNodes[ti].x - simNodes[si].x;
      const dy = simNodes[ti].y - simNodes[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - idealEdgeLen) * springK;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      simNodes[si].vx += fx;
      simNodes[si].vy += fy;
      simNodes[ti].vx -= fx;
      simNodes[ti].vy -= fy;
    }

    // 中心引力 — 增强，防止孤立分量飘走
    for (const n of simNodes) {
      n.vx += (centerX - n.x) * centerGravity;
      n.vy += (centerY - n.y) * centerGravity;
    }

    // 应用速度（拖拽中的节点使用固定位置）
    for (const n of simNodes) {
      if (n.fx !== undefined && n.fy !== undefined) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
      } else {
        n.vx *= 0.85; // 更强阻尼让图更快稳定
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // 边界约束（更宽松，允许画布外溢一点配合平移缩放）
        n.x = Math.max(-200, Math.min(w + 200, n.x));
        n.y = Math.max(-200, Math.min(h + 200, n.y));
      }
    }
  }, [edges]);

  /** 屏幕坐标 → 世界坐标 */
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (sy - t.offsetY) / t.scale,
    };
  }, []);

  /** 在世界坐标下查找节点 */
  const findNodeAt = useCallback((wx: number, wy: number): SimNode | null => {
    const simNodes = simNodesRef.current;
    // 从后往前查找（后渲染的在上面）
    for (let i = simNodes.length - 1; i >= 0; i--) {
      const n = simNodes[i];
      const r = nodeRadius(n.concept, edges);
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }, [edges]);

  /** 获取关联节点集合 */
  const getRelatedConcepts = useCallback((concept: string): Set<string> => {
    const related = new Set<string>();
    for (const e of edges) {
      if (e.from === concept) related.add(e.to);
      if (e.to === concept) related.add(e.from);
    }
    return related;
  }, [edges]);

  // Canvas 渲染 + 动画循环
  useEffect(() => {
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    let frameCount = 0;
    let hasFittedView = false;

    // 响应式调整 canvas 尺寸
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    /** 自动适配视图：缩放平移让所有节点可见 */
    const fitToView = () => {
      const simNodes = simNodesRef.current;
      if (simNodes.length === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of simNodes) {
        const r = nodeRadius(n.concept, edges);
        minX = Math.min(minX, n.x - r);
        maxX = Math.max(maxX, n.x + r);
        minY = Math.min(minY, n.y - r);
        maxY = Math.max(maxY, n.y + r);
      }
      const graphW = maxX - minX;
      const graphH = maxY - minY;
      const padding = 80;
      const scaleX = (canvas.width - padding * 2) / graphW;
      const scaleY = (canvas.height - padding * 2) / graphH;
      const scale = Math.max(0.2, Math.min(2, Math.min(scaleX, scaleY)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      transformRef.current = {
        offsetX: canvas.width / 2 - cx * scale,
        offsetY: canvas.height / 2 - cy * scale,
        scale,
      };
    };

    const animate = () => {
      if (!running) return;
      tick();
      frameCount++;

      // 模拟稳定后自动适配视图（仅一次）
      if (!hasFittedView && frameCount === 80) {
        fitToView();
        hasFittedView = true;
      }

      const { width, height } = canvas;
      const t = transformRef.current;
      const simNodes = simNodesRef.current;
      const hl = highlightConcept;
      const relatedSet = hl ? getRelatedConcepts(hl) : null;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(t.offsetX, t.offsetY);
      ctx.scale(t.scale, t.scale);

      // 构建 concept -> SimNode 映射
      const nodeMap = new Map<string, SimNode>();
      simNodes.forEach((n) => nodeMap.set(n.concept, n));

      // --- 绘制边 ---
      for (const e of edges) {
        const fromNode = nodeMap.get(e.from);
        const toNode = nodeMap.get(e.to);
        if (!fromNode || !toNode) continue;

        const isHighlighted = hl && (e.from === hl || e.to === hl);
        const isDimmed = hl && !isHighlighted;

        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);

        if (isDimmed) {
          ctx.strokeStyle = "rgba(180,175,165,0.08)";
          ctx.lineWidth = 1 / t.scale;
        } else if (isHighlighted) {
          ctx.strokeStyle = "rgba(180,175,165,0.8)";
          ctx.lineWidth = 2 / t.scale;
        } else {
          ctx.strokeStyle = "rgba(180,175,165,0.3)";
          ctx.lineWidth = 1 / t.scale;
        }
        ctx.stroke();
      }

      // --- 绘制节点 ---
      for (const n of simNodes) {
        const r = nodeRadius(n.concept, edges);
        const isSelected = hl === n.concept;
        const isRelated = hl !== null && relatedSet !== null && relatedSet.has(n.concept);
        const isDimmed = hl !== null && !isSelected && !isRelated;

        ctx.save();

        // 节点圆形
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

        const baseColor = confidenceColor(n.confidence);

        if (isDimmed) {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = baseColor;
          ctx.fill();
        } else {
          ctx.globalAlpha = isRelated ? 0.95 : 0.85;
          ctx.fillStyle = baseColor;
          ctx.fill();
        }

        // 选中节点：白色描边 + 阴影
        if (isSelected) {
          ctx.globalAlpha = 1;
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 12;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3 / t.scale;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (!isDimmed) {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = "#EEECE2";
          ctx.lineWidth = 1.5 / t.scale;
          ctx.stroke();
        }

        ctx.restore();

        // --- 绘制文字 ---
        if (!isDimmed) {
          ctx.save();
          ctx.globalAlpha = isDimmed ? 0.15 : 1;
          ctx.fillStyle = "#ffffff";
          ctx.font = `600 ${11 / t.scale}px -apple-system, "Noto Sans SC", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const lines = wrapText(n.concept, 6);
          const lineHeight = 13 / t.scale;
          const startY = n.y - ((lines.length - 1) * lineHeight) / 2;
          for (let li = 0; li < lines.length; li++) {
            ctx.fillText(lines[li], n.x, startY + li * lineHeight);
          }
          ctx.restore();
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [nodes, edges, tick, highlightConcept, getRelatedConcepts]);

  // --- Canvas 交互事件 ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);

    const node = findNodeAt(wx, wy);
    if (node) {
      // 开始拖拽节点
      dragNodeRef.current = node;
      isDraggingRef.current = false;
      node.fx = node.x;
      node.fy = node.y;
    } else {
      // 开始画布平移
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: transformRef.current.offsetX,
        oy: transformRef.current.offsetY,
      };
    }
  }, [screenToWorld, findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragNodeRef.current) {
      isDraggingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      dragNodeRef.current.fx = wx;
      dragNodeRef.current.fy = wy;
    } else if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      transformRef.current.offsetX = panStartRef.current.ox + dx;
      transformRef.current.offsetY = panStartRef.current.oy + dy;
    }
  }, [screenToWorld]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragNodeRef.current) {
      if (!isDraggingRef.current) {
        // 没有拖拽 → 当作点击事件
        const concept = dragNodeRef.current.concept;
        if (highlightConcept === concept) {
          // 再次点击同一节点 → 取消高亮
          setHighlightConcept(null);
        } else {
          setHighlightConcept(concept);
          // 同时选中详情面板
          const node = nodes.find((n) => n.concept === concept);
          if (node) setSelected(node);
        }
      }
      // 结束拖拽，解除固定
      delete dragNodeRef.current.fx;
      delete dragNodeRef.current.fy;
      dragNodeRef.current = null;
      isDraggingRef.current = false;
    } else if (isPanningRef.current) {
      isPanningRef.current = false;
      // 如果几乎没移动 → 点击空白取消高亮
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        setHighlightConcept(null);
      }
    }
  }, [highlightConcept, nodes]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const t = transformRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.2, Math.min(5, t.scale * zoomFactor));

    // 以鼠标位置为中心缩放
    t.offsetX = mx - (mx - t.offsetX) * (newScale / t.scale);
    t.offsetY = my - (my - t.offsetY) * (newScale / t.scale);
    t.scale = newScale;
  }, []);

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
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#6b9e78"}} />
              已掌握
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#c4a54d"}} />
              学习中
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{backgroundColor: "#c47a6c"}} />
              薄弱
            </span>
          </div>
        </div>
      </div>
  ) : (
      <div className="relative flex h-full bg-[#EEECE2]">
      {/* 图谱区域 */}
      <div className="flex-1 relative">
        <div className="absolute left-4 top-4 z-10">
          <h1 className="text-lg font-semibold text-stone-800">知识图谱</h1>
          <div className="mt-2 flex gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#6b9e78"}} />
              已掌握
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#c4a54d"}} />
              学习中
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{backgroundColor: "#c47a6c"}} />
              薄弱
            </span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>

      {/* Detail panel — 统一卡片风格 */}
      {selected && (
        <div className="absolute right-4 top-4 bottom-4 z-10 w-72 shrink-0 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
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
              onClick={() => router.push(`/?q=${encodeURIComponent(fill("learn_concept", { concept: selected.concept }))}`)}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#C67A4A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a]"
            >
              开始学习「{selected.concept}」
            </button>

            <button
              type="button"
              onClick={() => router.push(`/quiz?concept=${encodeURIComponent(selected.concept)}`)}
              className="mt-1 flex w-full items-center justify-center rounded-lg border border-[#C67A4A] px-4 py-2 text-sm text-[#C67A4A] transition hover:bg-[#C67A4A]/10"
            >
              出题测验
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!confirm(`确定删除知识点「${selected.concept}」？`)) return;
                try {
                  await deleteConcept(selected.concept);
                  setSelected(null);
                  // 刷新数据
                  const data = await getKnowledgeGraph();
                  setNodes(data.nodes);
                  setEdges(data.edges);
                } catch { /* 静默 */ }
              }}
              className="mt-1 flex w-full items-center justify-center rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
            >
              删除此知识点
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

            {/* 来源追溯 */}
            <div>
              <p className="text-xs text-stone-400">来源追溯</p>
              {sourcesLoading ? (
                <p className="mt-1 text-xs text-stone-400">加载中...</p>
              ) : sources.length === 0 ? (
                <p className="mt-1 text-xs text-stone-400">暂无来源记录</p>
              ) : (
                <div className="mt-1 space-y-1.5">
                  {sources.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600"
                    >
                      <span className="inline-block rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                        {s.source_type === "resource" ? "资料" : s.source_type === "quiz" ? "测验" : "对话"}
                      </span>
                      <span className="ml-1.5 text-stone-400">
                        {new Date(s.created_at).toLocaleDateString("zh-CN")}
                      </span>
                      {s.page_or_position && (
                        <span className="ml-1 text-stone-400">· {s.page_or_position}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
  )}
    </MainShell>
  );
}
