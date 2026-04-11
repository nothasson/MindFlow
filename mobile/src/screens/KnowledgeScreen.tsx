import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type {
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeSourceLink,
} from "../lib/types";
import { ERROR_TYPE_LABELS, type ErrorType } from "../lib/types";

// ===== 类型 =====

type ViewMode = "list" | "graph";

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: KnowledgeNode;
  degree: number;
}

// ===== 工具函数 =====

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return colors.success;
  if (confidence >= 0.3) return colors.warning;
  return colors.error;
}

function strengthColor(strength: number): string {
  if (strength >= 0.7) return colors.stone600;
  if (strength >= 0.4) return colors.stone400;
  return colors.stone300;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ===== 力导向布局 =====

function computeForceLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  // 计算每个节点的度数
  const degreeMap = new Map<string, number>();
  for (const n of nodes) degreeMap.set(n.concept, 0);
  for (const e of edges) {
    degreeMap.set(e.from, (degreeMap.get(e.from) ?? 0) + 1);
    degreeMap.set(e.to, (degreeMap.get(e.to) ?? 0) + 1);
  }

  // 初始化布局节点（随机位置）
  const cx = width / 2;
  const cy = height / 2;
  const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.3;
    return {
      id: n.concept,
      x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      node: n,
      degree: degreeMap.get(n.concept) ?? 0,
    };
  });

  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of layoutNodes) nodeMap.set(ln.id, ln);

  // 力模拟迭代
  const iterations = 80;
  const repulsion = 3000;
  const attraction = 0.005;
  const centerGravity = 0.02;
  const damping = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // 斥力（节点之间）
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (repulsion * alpha) / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }

    // 引力（边连接的节点）
    for (const e of edges) {
      const a = nodeMap.get(e.from);
      const b = nodeMap.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const force = attraction * alpha * (e.strength ?? 0.5);
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }

    // 中心引力
    for (const n of layoutNodes) {
      n.vx += (cx - n.x) * centerGravity * alpha;
      n.vy += (cy - n.y) * centerGravity * alpha;
    }

    // 更新位置
    const padding = 30;
    for (const n of layoutNodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // 边界约束
      n.x = Math.max(padding, Math.min(width - padding, n.x));
      n.y = Math.max(padding, Math.min(height - padding, n.y));
    }
  }

  return layoutNodes;
}

// ===== 子组件 =====

/** 掌握度进度条 */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidenceColor(confidence);
  return (
    <View style={barStyles.container}>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.stone200,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
  label: { fontSize: 13, fontWeight: "600", width: 40, textAlign: "right" },
});

/** 知识点列表卡片 */
function KnowledgeCard({
  node,
  onPress,
}: {
  node: KnowledgeNode;
  onPress: () => void;
}) {
  return (
    <Pressable style={cardStyles.card} onPress={onPress}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.concept} numberOfLines={1}>
          {node.concept}
        </Text>
        {node.bloom_level ? (
          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeText}>{node.bloom_level}</Text>
          </View>
        ) : null}
      </View>
      <ConfidenceBar confidence={node.confidence} />
      <View style={cardStyles.meta}>
        <Text style={cardStyles.metaText}>
          间隔 {node.interval_days} 天
        </Text>
        <Text style={cardStyles.metaText}>
          下次复习：{formatDate(node.next_review)}
        </Text>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  concept: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone800,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.stone100,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { fontSize: 11, color: colors.stone500 },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: { fontSize: 12, color: colors.stone400 },
});

/** 节点详情面板 */
function NodeDetailModal({
  node,
  edges,
  allNodes,
  visible,
  onClose,
  onLearn,
  onQuiz,
  onDelete,
}: {
  node: KnowledgeNode | null;
  edges: KnowledgeEdge[];
  allNodes: KnowledgeNode[];
  visible: boolean;
  onClose: () => void;
  onLearn: (concept: string) => void;
  onQuiz: (concept: string) => void;
  onDelete: (concept: string) => void;
}) {
  const [sources, setSources] = useState<KnowledgeSourceLink[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  useEffect(() => {
    if (!node || !visible) {
      setSources([]);
      return;
    }
    setLoadingSources(true);
    api
      .getKnowledgeSources(node.concept)
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, [node, visible]);

  if (!node) return null;

  // 找关联概念
  const related = edges
    .filter((e) => e.from === node.concept || e.to === node.concept)
    .map((e) => ({
      concept: e.from === node.concept ? e.to : e.from,
      relation: e.relation_type,
      strength: e.strength ?? 0.5,
    }));

  const pct = Math.round(node.confidence * 100);

  const sourceTypeLabels: Record<string, string> = {
    resource: "资源",
    conversation: "对话",
    quiz: "测验",
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={detailStyles.container}>
        {/* 头部 */}
        <View style={detailStyles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={detailStyles.closeBtn}>关闭</Text>
          </Pressable>
          <Text style={detailStyles.title} numberOfLines={2}>
            {node.concept}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={detailStyles.scroll}
          contentContainerStyle={detailStyles.scrollContent}
        >
          {/* 掌握度 */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>掌握度</Text>
            <ConfidenceBar confidence={node.confidence} />
          </View>

          {/* 学习统计 */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>学习统计</Text>
            <View style={detailStyles.statsGrid}>
              <StatItem label="重复次数" value={String(node.repetitions)} />
              <StatItem label="间隔天数" value={String(node.interval_days)} />
              <StatItem label="简易因子" value={node.easiness_factor.toFixed(2)} />
              <StatItem
                label="下次复习"
                value={formatDate(node.next_review)}
              />
              {node.importance != null ? (
                <StatItem
                  label="重要程度"
                  value={`${Math.round(node.importance * 100)}%`}
                />
              ) : null}
              {node.bloom_level ? (
                <StatItem label="布鲁姆层级" value={node.bloom_level} />
              ) : null}
            </View>
          </View>

          {/* 描述 */}
          {node.description ? (
            <View style={detailStyles.section}>
              <Text style={detailStyles.sectionTitle}>描述</Text>
              <Text style={detailStyles.descriptionText}>{node.description}</Text>
            </View>
          ) : null}

          {/* 错误类型 */}
          {node.error_type ? (
            <View style={detailStyles.section}>
              <Text style={detailStyles.sectionTitle}>错误类型</Text>
              <View style={detailStyles.errorBadge}>
                <Text style={detailStyles.errorBadgeText}>
                  {ERROR_TYPE_LABELS[node.error_type as ErrorType] ?? node.error_type}
                </Text>
              </View>
            </View>
          ) : null}

          {/* 关联概念 */}
          {related.length > 0 ? (
            <View style={detailStyles.section}>
              <Text style={detailStyles.sectionTitle}>
                关联概念（{related.length}）
              </Text>
              {related.map((r, i) => (
                <View key={i} style={detailStyles.relatedItem}>
                  <View style={detailStyles.relatedDot} />
                  <Text style={detailStyles.relatedConcept}>{r.concept}</Text>
                  <Text style={detailStyles.relatedType}>{relationLabel(r.relation)}</Text>
                  <Text style={detailStyles.relatedStrength}>
                    {Math.round(r.strength * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 知识来源 */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>知识来源</Text>
            {loadingSources ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : sources.length === 0 ? (
              <Text style={detailStyles.emptyText}>暂无来源记录</Text>
            ) : (
              sources.map((s) => (
                <View key={s.id} style={detailStyles.sourceItem}>
                  <Text style={detailStyles.sourceType}>
                    {sourceTypeLabels[s.source_type] ?? s.source_type}
                  </Text>
                  <Text style={detailStyles.sourcePos} numberOfLines={1}>
                    {s.page_or_position || "—"}
                  </Text>
                  <Text style={detailStyles.sourceDate}>
                    {formatDate(s.created_at)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* 操作按钮 */}
        <View style={detailStyles.actions}>
          <Pressable
            style={[detailStyles.actionBtn, { backgroundColor: colors.brand }]}
            onPress={() => {
              onClose();
              onLearn(node.concept);
            }}
          >
            <Text style={detailStyles.actionBtnText}>学习</Text>
          </Pressable>
          <Pressable
            style={[detailStyles.actionBtn, { backgroundColor: colors.info }]}
            onPress={() => {
              onClose();
              onQuiz(node.concept);
            }}
          >
            <Text style={detailStyles.actionBtnText}>测验</Text>
          </Pressable>
          <Pressable
            style={[detailStyles.actionBtn, { backgroundColor: colors.error }]}
            onPress={() => {
              Alert.alert("确认删除", `确定要删除「${node.concept}」吗？`, [
                { text: "取消", style: "cancel" },
                {
                  text: "删除",
                  style: "destructive",
                  onPress: () => {
                    onClose();
                    onDelete(node.concept);
                  },
                },
              ]);
            }}
          >
            <Text style={detailStyles.actionBtnText}>删除</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.statItem}>
      <Text style={detailStyles.statValue}>{value}</Text>
      <Text style={detailStyles.statLabel}>{label}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone200,
  },
  closeBtn: { fontSize: 16, color: colors.brand, fontWeight: "500" },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.stone800,
    textAlign: "center",
    marginHorizontal: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 32 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone600,
    marginBottom: 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    width: "47%",
    backgroundColor: colors.stone50,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: colors.stone800 },
  statLabel: { fontSize: 12, color: colors.stone400, marginTop: 2 },
  errorBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorBadgeText: { fontSize: 13, color: colors.error, fontWeight: "500" },
  descriptionText: { fontSize: 14, color: colors.stone700, lineHeight: 20 },
  relatedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone100,
  },
  relatedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  relatedConcept: {
    flex: 1,
    fontSize: 14,
    color: colors.stone700,
  },
  relatedType: {
    fontSize: 11,
    color: colors.stone400,
    backgroundColor: colors.stone100,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  relatedStrength: { fontSize: 12, color: colors.stone400, width: 36, textAlign: "right" },
  emptyText: { fontSize: 13, color: colors.stone400 },
  sourceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone100,
  },
  sourceType: {
    fontSize: 12,
    color: colors.white,
    backgroundColor: colors.brand,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    fontWeight: "500",
  },
  sourcePos: { flex: 1, fontSize: 13, color: colors.stone600 },
  sourceDate: { fontSize: 11, color: colors.stone400 },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    backgroundColor: colors.white,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnText: { fontSize: 15, fontWeight: "600", color: colors.white },
});

/** 关系类型中文标签 */
function relationLabel(type: string): string {
  const map: Record<string, string> = {
    prerequisite: "前置知识",
    related: "相关",
    includes: "包含",
    extends: "扩展",
    conflicts: "冲突",
    similar: "相似",
  };
  return map[type] ?? type;
}

/** 力导向图视图 */
function GraphView({
  nodes,
  edges,
  onSelectNode,
}: {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  onSelectNode: (node: KnowledgeNode) => void;
}) {
  const { width: screenWidth } = Dimensions.get("window");
  const svgWidth = screenWidth - 24;
  const svgHeight = screenWidth * 1.08;

  const layoutNodes = useMemo(
    () => computeForceLayout(nodes, edges, svgWidth, svgHeight),
    [nodes, edges, svgWidth, svgHeight],
  );

  const layoutMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const ln of layoutNodes) m.set(ln.id, ln);
    return m;
  }, [layoutNodes]);

  // 缩放 + 平移
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastOffset = useRef({ x: 0, y: 0 });
  const lastDist = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
        onPanResponderGrant: () => {
          lastOffset.current = { ...offset };
          lastDist.current = 0;
        },
        onPanResponderMove: (evt, gs) => {
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length === 2) {
            // 双指缩放
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (lastDist.current > 0) {
              const ratio = dist / lastDist.current;
              setScale((s) => Math.max(0.3, Math.min(3, s * ratio)));
            }
            lastDist.current = dist;
          } else {
            // 单指平移
            setOffset({
              x: lastOffset.current.x + gs.dx,
              y: lastOffset.current.y + gs.dy,
            });
          }
        },
        onPanResponderRelease: () => {
          lastDist.current = 0;
        },
      }),
    [offset],
  );

  // 最大度数，用于计算节点大小
  const maxDegree = Math.max(1, ...layoutNodes.map((n) => n.degree));

  const handleNodePress = useCallback(
    (concept: string) => {
      const node = nodes.find((n) => n.concept === concept);
      if (node) onSelectNode(node);
    },
    [nodes, onSelectNode],
  );

  if (nodes.length === 0) {
    return (
      <View style={graphStyles.empty}>
        <Text style={graphStyles.emptyText}>暂无知识点</Text>
        <Text style={graphStyles.emptySubtext}>上传学习资料后，知识图谱将在这里展示</Text>
      </View>
    );
  }

  return (
    <View style={graphStyles.container}>
      <View style={graphStyles.zoomControls}>
        <Pressable
          style={graphStyles.zoomBtn}
          onPress={() => setScale((s) => Math.min(3, s + 0.2))}
        >
          <Text style={graphStyles.zoomBtnText}>+</Text>
        </Pressable>
        <Pressable
          style={graphStyles.zoomBtn}
          onPress={() => setScale((s) => Math.max(0.3, s - 0.2))}
        >
          <Text style={graphStyles.zoomBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={graphStyles.zoomBtn}
          onPress={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
            lastOffset.current = { x: 0, y: 0 };
          }}
        >
          <Text style={[graphStyles.zoomBtnText, { fontSize: 13 }]}>重置</Text>
        </Pressable>
      </View>

      <View {...panResponder.panHandlers} style={graphStyles.canvasShell}>
        <Svg width={svgWidth} height={svgHeight}>
          {edges.map((e) => {
            const from = layoutMap.get(e.from);
            const to = layoutMap.get(e.to);
            if (!from || !to) return null;
            return (
              <Line
                key={e.id}
                x1={from.x * scale + offset.x}
                y1={from.y * scale + offset.y}
                x2={to.x * scale + offset.x}
                y2={to.y * scale + offset.y}
                stroke={strengthColor(e.strength ?? 0.5)}
                strokeWidth={Math.max(1.5, (e.strength ?? 0.5) * 3.5)}
                opacity={0.42}
              />
            );
          })}

          {layoutNodes.map((ln) => {
            const baseR = 14;
            const r = baseR + (ln.degree / maxDegree) * 14;
            const cx = ln.x * scale + offset.x;
            const cy = ln.y * scale + offset.y;
            const fill = confidenceColor(ln.node.confidence);
            const label = ln.id.length > 8 ? ln.id.slice(0, 8) + "…" : ln.id;
            const labelWidth = Math.max(42, label.length * 10 + 14);
            return (
              <React.Fragment key={ln.id}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  opacity={0.92}
                  stroke="rgba(255,255,255,0.96)"
                  strokeWidth={2}
                  onPress={() => handleNodePress(ln.id)}
                />
                {scale >= 0.6 && (
                  <>
                    <Rect
                      x={cx - labelWidth / 2}
                      y={cy + r + 8}
                      width={labelWidth}
                      height={20}
                      rx={10}
                      fill="rgba(255,255,255,0.95)"
                      stroke="rgba(214, 211, 209, 0.8)"
                    />
                    <SvgText
                      x={cx}
                      y={cy + r + 22}
                      textAnchor="middle"
                      fontSize={10.5 * Math.min(scale, 1.1)}
                      fill={colors.stone700}
                      fontWeight="600"
                      onPress={() => handleNodePress(ln.id)}
                    >
                      {label}
                    </SvgText>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      <View style={graphStyles.legend}>
        <View style={graphStyles.legendItem}>
          <View style={[graphStyles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={graphStyles.legendText}>掌握 ≥70%</Text>
        </View>
        <View style={graphStyles.legendItem}>
          <View style={[graphStyles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={graphStyles.legendText}>学习中 30-70%</Text>
        </View>
        <View style={graphStyles.legendItem}>
          <View style={[graphStyles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={graphStyles.legendText}>薄弱 &lt;30%</Text>
        </View>
      </View>
    </View>
  );
}

const graphStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: colors.stone600 },
  emptySubtext: { fontSize: 13, color: colors.stone400, marginTop: 4, textAlign: "center" },
  zoomControls: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    gap: 6,
  },
  canvasShell: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(231, 229, 228, 0.9)",
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  zoomBtnText: { fontSize: 20, fontWeight: "600", color: colors.stone700 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 14,
    backgroundColor: colors.background,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: colors.stone500,
  },
});

// ===== 主屏幕 =====

export function KnowledgeScreen({ navigation }: { navigation: any }) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getKnowledgeGraph();
      setGraph(data);
    } catch {
      setGraph({ nodes: [], edges: [] });
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // 搜索过滤
  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    if (!search.trim()) return graph.nodes;
    const q = search.trim().toLowerCase();
    return graph.nodes.filter((n) => n.concept.toLowerCase().includes(q));
  }, [graph, search]);

  const filteredEdges = useMemo(() => {
    if (!graph) return [];
    const conceptSet = new Set(filteredNodes.map((n) => n.concept));
    return graph.edges.filter(
      (e) => conceptSet.has(e.from) && conceptSet.has(e.to),
    );
  }, [graph, filteredNodes]);

  const handleSelectNode = useCallback((node: KnowledgeNode) => {
    setSelectedNode(node);
    setDetailVisible(true);
  }, []);

  const handleLearn = useCallback(
    (concept: string) => {
      navigation.navigate("主导航", {
        screen: "聊天",
        params: { prompt: `我想系统学习「${concept}」，请从核心概念开始引导我。` },
      });
    },
    [navigation],
  );

  const handleQuiz = useCallback(
    (concept: string) => {
      navigation.navigate("主导航", {
        screen: "测验",
        params: { concept },
      });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    async (concept: string) => {
      try {
        await api.deleteKnowledgeConcept(concept);
        await loadData();
      } catch {
        Alert.alert("删除失败", "请稍后重试");
      }
    },
    [loadData],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 顶部标题 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>知识图谱</Text>
        <Text style={styles.headerCount}>
          {graph ? `${graph.nodes.length} 个知识点` : ""}
        </Text>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索知识点…"
          placeholderTextColor={colors.stone400}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* 视图切换 Tab */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, viewMode === "list" && styles.tabActive]}
          onPress={() => setViewMode("list")}
        >
          <Text
            style={[
              styles.tabText,
              viewMode === "list" && styles.tabTextActive,
            ]}
          >
            列表
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === "graph" && styles.tabActive]}
          onPress={() => setViewMode("graph")}
        >
          <Text
            style={[
              styles.tabText,
              viewMode === "graph" && styles.tabTextActive,
            ]}
          >
            图谱
          </Text>
        </Pressable>
      </View>

      {/* 内容区 */}
      {viewMode === "list" ? (
        <FlatList
          data={filteredNodes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <KnowledgeCard node={item} onPress={() => handleSelectNode(item)} />
          )}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {search ? "没有匹配的知识点" : "暂无知识点"}
              </Text>
              <Text style={styles.emptySubtext}>
                {search
                  ? "尝试其他关键词"
                  : "上传学习资料后，知识点将在这里展示"}
              </Text>
            </View>
          }
        />
      ) : (
        <GraphView
          nodes={filteredNodes}
          edges={filteredEdges}
          onSelectNode={handleSelectNode}
        />
      )}

      {/* 详情面板 */}
      <NodeDetailModal
        node={selectedNode}
        edges={graph?.edges ?? []}
        allNodes={graph?.nodes ?? []}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onLearn={handleLearn}
        onQuiz={handleQuiz}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.stone800,
  },
  headerCount: {
    fontSize: 13,
    color: colors.stone400,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone800,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.stone100,
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.stone500,
  },
  tabTextActive: {
    color: colors.stone800,
    fontWeight: "600",
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone600,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.stone400,
    marginTop: 4,
    textAlign: "center",
  },
});

export default KnowledgeScreen;
