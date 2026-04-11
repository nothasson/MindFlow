import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { ErrorType, WrongBookEntry, WrongBookStats } from "../lib/types";
import { ERROR_TYPE_LABELS } from "../lib/types";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

// 启用 Android LayoutAnimation
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ALL_ERROR_TYPES: ErrorType[] = [
  "knowledge_gap",
  "concept_confusion",
  "concept_error",
  "method_error",
  "calculation_error",
  "overconfidence",
  "strategy_error",
  "unclear_expression",
];

/** 错误类型对应的颜色 */
const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  knowledge_gap: "#ef4444",
  concept_confusion: "#f59e0b",
  concept_error: "#f97316",
  method_error: "#8b5cf6",
  calculation_error: "#3b82f6",
  overconfidence: "#ec4899",
  strategy_error: "#6366f1",
  unclear_expression: "#78716c",
};

export function WrongbookScreen() {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<WrongBookStats | null>(null);
  const [entries, setEntries] = useState<WrongBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<ErrorType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        const [statsData, entriesData] = await Promise.all([
          api.getWrongBookStats(),
          api.getWrongBook(selectedType ?? undefined),
        ]);
        setStats(statsData);
        setEntries(entriesData);
      } catch {
        // 静默失败
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedType]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const handleSelectType = useCallback((type: ErrorType | null) => {
    setSelectedType(type);
    setExpandedId(null);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleMarkReviewed = useCallback(
    async (id: string) => {
      try {
        await api.markWrongBookReviewed(id);
        fetchData(false);
      } catch {
        Alert.alert("操作失败", "标记已复习失败，请稍后重试");
      }
    },
    [fetchData]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("确认删除", "确定要删除这条错题记录吗？删除后不可恢复。", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteWrongBookEntry(id);
              setExpandedId(null);
              fetchData(false);
            } catch {
              Alert.alert("操作失败", "删除失败，请稍后重试");
            }
          },
        },
      ]);
    },
    [fetchData]
  );

  const handlePractice = useCallback(
    (concept: string) => {
      navigation.navigate("主导航", {
        screen: "测验",
        params: { concept },
      });
    },
    [navigation]
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${month}月${day}日 ${hours}:${minutes}`;
  };

  // ===== 渲染 =====

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStatsCard = () => {
    if (!stats) return null;
    return (
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>总错题</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {stats.unreviewed}
          </Text>
          <Text style={styles.statLabel}>未复习</Text>
        </View>
      </View>
    );
  };

  const renderErrorTypeDistribution = () => {
    if (!stats?.by_error_type) return null;
    const items = Object.entries(stats.by_error_type).filter(
      ([, count]) => count > 0
    );
    if (items.length === 0) return null;

    return (
      <View style={styles.distributionRow}>
        {items.map(([type, count]) => (
          <View
            key={type}
            style={[
              styles.distributionBadge,
              {
                backgroundColor:
                  (ERROR_TYPE_COLORS[type as ErrorType] ?? colors.stone400) +
                  "18",
              },
            ]}
          >
            <Text
              style={[
                styles.distributionText,
                {
                  color:
                    ERROR_TYPE_COLORS[type as ErrorType] ?? colors.stone500,
                },
              ]}
            >
              {ERROR_TYPE_LABELS[type as ErrorType] ?? type} {count}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFilterTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContainer}
      style={styles.filterScroll}
    >
      <Pressable
        style={[
          styles.filterTab,
          selectedType === null && styles.filterTabActive,
        ]}
        onPress={() => handleSelectType(null)}
      >
        <Text
          style={[
            styles.filterTabText,
            selectedType === null && styles.filterTabTextActive,
          ]}
        >
          全部
        </Text>
      </Pressable>
      {ALL_ERROR_TYPES.map((type) => (
        <Pressable
          key={type}
          style={[
            styles.filterTab,
            selectedType === type && styles.filterTabActive,
          ]}
          onPress={() => handleSelectType(type)}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedType === type && styles.filterTabTextActive,
            ]}
          >
            {ERROR_TYPE_LABELS[type]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderEntryCard = ({ item }: { item: WrongBookEntry }) => {
    const isExpanded = expandedId === item.id;
    const badgeColor = ERROR_TYPE_COLORS[item.error_type] ?? colors.stone400;

    return (
      <Pressable
        style={styles.entryCard}
        onPress={() => handleToggleExpand(item.id)}
      >
        {/* 卡片头部 */}
        <View style={styles.entryHeader}>
          <View style={styles.entryTitleRow}>
            <Text style={styles.entryConcept} numberOfLines={1}>
              {item.concept}
            </Text>
            <View
              style={[
                styles.errorBadge,
                { backgroundColor: badgeColor + "18" },
              ]}
            >
              <Text style={[styles.errorBadgeText, { color: badgeColor }]}>
                {ERROR_TYPE_LABELS[item.error_type]}
              </Text>
            </View>
          </View>
          <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
        </View>

        {/* 展开内容 */}
        {isExpanded && (
          <View style={styles.entryExpanded}>
            {/* 原始问题 */}
            <View style={styles.entrySection}>
              <Text style={styles.entrySectionTitle}>题目</Text>
              <View style={styles.markdownContainer}>
                <MarkdownRenderer content={item.question} />
              </View>
            </View>

            {/* 我的回答 */}
            <View style={styles.entrySection}>
              <Text style={styles.entrySectionTitle}>我的回答</Text>
              <Text style={styles.entryAnswer}>{item.user_answer}</Text>
            </View>

            {/* 复习信息 */}
            <View style={styles.reviewInfoRow}>
              <View style={styles.reviewInfoItem}>
                <Text style={styles.reviewInfoLabel}>复习次数</Text>
                <Text style={styles.reviewInfoValue}>{item.review_count}</Text>
              </View>
              <View style={styles.reviewInfoItem}>
                <Text style={styles.reviewInfoLabel}>复习状态</Text>
                <Text
                  style={[
                    styles.reviewInfoValue,
                    { color: item.reviewed ? colors.success : colors.warning },
                  ]}
                >
                  {item.reviewed ? "已复习" : "未复习"}
                </Text>
              </View>
            </View>

            {/* 操作按钮 */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => handlePractice(item.concept)}
              >
                <Text style={styles.actionBtnPrimaryText}>练习强化</Text>
              </Pressable>
              {!item.reviewed && (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => handleMarkReviewed(item.id)}
                >
                  <Text style={styles.actionBtnSecondaryText}>标记已复习</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.actionBtnDangerText}>删除</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无错题记录</Text>
      <Text style={styles.emptySubtext}>
        {selectedType
          ? "当前筛选条件下没有错题"
          : "完成测验后，错题会自动记录在这里"}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>错题本</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntryCard}
        ListHeaderComponent={
          <>
            {renderStatsCard()}
            {renderErrorTypeDistribution()}
            {renderFilterTabs()}
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  listContent: {
    paddingBottom: 32,
  },

  // ===== 统计卡片 =====
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.stone100,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.stone800,
  },
  statLabel: {
    fontSize: 13,
    color: colors.stone500,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.stone300,
  },

  // ===== 错误类型分布 =====
  distributionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  distributionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distributionText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // ===== 过滤标签 =====
  filterScroll: {
    marginTop: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  filterTabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.stone600,
  },
  filterTabTextActive: {
    color: colors.white,
  },

  // ===== 错题卡片 =====
  entryCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  entryHeader: {
    gap: 6,
  },
  entryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryConcept: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
  },
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  entryDate: {
    fontSize: 12,
    color: colors.stone400,
  },

  // ===== 展开内容 =====
  entryExpanded: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    paddingTop: 14,
    gap: 14,
  },
  entrySection: {
    gap: 6,
  },
  entrySectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.stone500,
  },
  markdownContainer: {
    backgroundColor: colors.stone50,
    borderRadius: 10,
    padding: 12,
  },
  entryAnswer: {
    fontSize: 14,
    color: colors.stone700,
    lineHeight: 20,
    backgroundColor: colors.stone50,
    borderRadius: 10,
    padding: 12,
    overflow: "hidden",
  },

  // ===== 复习信息 =====
  reviewInfoRow: {
    flexDirection: "row",
    gap: 16,
  },
  reviewInfoItem: {
    gap: 2,
  },
  reviewInfoLabel: {
    fontSize: 12,
    color: colors.stone400,
  },
  reviewInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone700,
  },

  // ===== 操作按钮 =====
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  actionBtnPrimary: {
    backgroundColor: colors.brand,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
  },
  actionBtnSecondary: {
    backgroundColor: colors.stone100,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone700,
  },
  actionBtnDanger: {
    backgroundColor: colors.error + "10",
    borderWidth: 1,
    borderColor: colors.error + "30",
  },
  actionBtnDangerText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.error,
  },

  // ===== 空态 =====
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
    marginTop: 6,
    textAlign: "center",
  },
});
