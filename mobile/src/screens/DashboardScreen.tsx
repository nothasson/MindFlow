import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { DashboardStats, HeatmapDay } from "../lib/types";

function heatmapColor(count: number, maxCount: number): string {
  if (count === 0) return colors.stone100;
  const ratio = count / Math.max(maxCount, 1);
  if (ratio >= 0.75) return colors.brand;
  if (ratio >= 0.5) return "rgba(198, 122, 74, 0.72)";
  if (ratio >= 0.25) return "rgba(198, 122, 74, 0.42)";
  return "rgba(198, 122, 74, 0.18)";
}

function formatDateLabel(date: string): string {
  const parsed = new Date(date);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statsData, heatmapData] = await Promise.all([
          api.getDashboardStats(),
          api.getDashboardHeatmap().catch(() => []),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setHeatmap(heatmapData);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setHeatmap([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentHeatmap = useMemo(() => heatmap.slice(-28), [heatmap]);
  const maxHeatmapCount = useMemo(
    () => recentHeatmap.reduce((max, item) => Math.max(max, item.count), 0),
    [recentHeatmap]
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>学习数据</Text>
        <Text style={styles.headerSubtitle}>查看你的活跃度、薄弱点和学习趋势</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {stats ? (
          <>
            <View style={styles.heroCard}>
              <View>
                <Text style={styles.heroEyebrow}>学习连续性</Text>
                <Text style={styles.heroValue}>{stats.streak} 天</Text>
                <Text style={styles.heroSubtext}>
                  累计学习 {stats.total_days} 天，继续保持节奏。
                </Text>
              </View>
              <View style={styles.heroSide}>
                <Text style={styles.heroSideValue}>{stats.total_messages}</Text>
                <Text style={styles.heroSideLabel}>消息总数</Text>
              </View>
            </View>

            <View style={styles.statGrid}>
              <StatCard label="对话" value={stats.total_conversations} />
              <StatCard label="资料" value={stats.total_resources} />
              <StatCard label="课程" value={stats.total_courses} />
              <StatCard label="学习天数" value={stats.total_days} />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>近 28 天活跃热力图</Text>
                <Text style={styles.sectionMeta}>按消息数统计</Text>
              </View>
              {recentHeatmap.length > 0 ? (
                <>
                  <View style={styles.heatmapGrid}>
                    {recentHeatmap.map((item) => (
                      <View key={item.date} style={styles.heatmapCellWrap}>
                        <View
                          style={[
                            styles.heatmapCell,
                            {
                              backgroundColor: heatmapColor(
                                item.count,
                                maxHeatmapCount
                              ),
                            },
                          ]}
                        />
                        <Text style={styles.heatmapLabel}>
                          {formatDateLabel(item.date)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.legendRow}>
                    <Text style={styles.legendText}>少</Text>
                    {[0, 1, 2, 3].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.legendBox,
                          {
                            backgroundColor: heatmapColor(
                              Math.round((maxHeatmapCount * level) / 3),
                              maxHeatmapCount
                            ),
                          },
                        ]}
                      />
                    ))}
                    <Text style={styles.legendText}>多</Text>
                  </View>
                </>
              ) : (
                <EmptyState text="暂无活跃数据，开始聊天学习后这里会出现热力图。" />
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>薄弱知识点</Text>
                <Pressable onPress={() => navigation.navigate("主导航", { screen: "测验" })}>
                  <Text style={styles.sectionAction}>去测验</Text>
                </Pressable>
              </View>
              {stats.weak_points.length > 0 ? (
                stats.weak_points.slice(0, 5).map((item, index) => (
                  <Pressable
                    key={item.concept}
                    style={[
                      styles.listRow,
                      index < Math.min(stats.weak_points.length, 5) - 1 &&
                        styles.listRowBorder,
                    ]}
                    onPress={() =>
                      navigation.navigate("主导航", {
                        screen: "测验",
                        params: { concept: item.concept },
                      })
                    }
                  >
                    <View style={styles.listLeft}>
                      <Text style={styles.listTitle}>{item.concept}</Text>
                      <Text style={styles.listSubtext}>
                        当前掌握度 {Math.round(item.confidence * 100)}%
                      </Text>
                    </View>
                    <Text style={styles.listAction}>开始巩固</Text>
                  </Pressable>
                ))
              ) : (
                <EmptyState text="暂时没有明显薄弱点，继续保持。" />
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>近 7 天学习趋势</Text>
                <Text style={styles.sectionMeta}>消息数</Text>
              </View>
              {stats.trend.length > 0 ? (
                stats.trend.map((item, index) => (
                  <View
                    key={item.date}
                    style={[
                      styles.trendRow,
                      index < stats.trend.length - 1 && styles.listRowBorder,
                    ]}
                  >
                    <Text style={styles.trendDate}>{formatDateLabel(item.date)}</Text>
                    <View style={styles.trendBarTrack}>
                      <View
                        style={[
                          styles.trendBarFill,
                          {
                            width: `${Math.max(
                              8,
                              (item.count /
                                Math.max(
                                  ...stats.trend.map((trendItem) => trendItem.count),
                                  1
                                )) *
                                100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.trendCount}>{item.count}</Text>
                  </View>
                ))
              ) : (
                <EmptyState text="最近 7 天还没有趋势数据。" />
              )}
            </View>
          </>
        ) : (
          <View style={styles.sectionCard}>
            <EmptyState text="暂无学习数据，开始聊天学习后这里会展示总览。" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(214, 211, 209, 0.4)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.stone800,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.stone500,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  heroCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  heroEyebrow: {
    fontSize: 13,
    color: colors.stone500,
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.brand,
    marginBottom: 4,
  },
  heroSubtext: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.stone500,
    maxWidth: 200,
  },
  heroSide: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  heroSideValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.stone800,
  },
  heroSideLabel: {
    fontSize: 12,
    color: colors.stone400,
    marginTop: 4,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.stone800,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.stone500,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },
  sectionMeta: {
    fontSize: 12,
    color: colors.stone400,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },
  heatmapGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  heatmapCellWrap: {
    width: "12%",
    alignItems: "center",
    marginBottom: 6,
  },
  heatmapCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginBottom: 4,
  },
  heatmapLabel: {
    fontSize: 9,
    color: colors.stone400,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 8,
  },
  legendText: {
    fontSize: 11,
    color: colors.stone400,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  listLeft: {
    flex: 1,
    marginRight: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone800,
    marginBottom: 3,
  },
  listSubtext: {
    fontSize: 12,
    color: colors.stone400,
  },
  listAction: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  trendDate: {
    width: 38,
    fontSize: 12,
    color: colors.stone500,
  },
  trendBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.stone100,
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  trendCount: {
    width: 24,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: colors.stone600,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.stone400,
    textAlign: "center",
  },
});
