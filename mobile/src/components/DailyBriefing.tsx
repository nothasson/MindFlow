import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { BriefingItem, DailyBriefing as DailyBriefingType } from "../lib/types";

interface DailyBriefingProps {
  onReviewItem?: (item: BriefingItem) => void;
  onNewItem?: (item: BriefingItem) => void;
  onQuizSuggestion?: (item: BriefingItem) => void;
}

export function DailyBriefing({
  onReviewItem,
  onNewItem,
  onQuizSuggestion,
}: DailyBriefingProps) {
  const navigation = useNavigation<any>();
  const [briefing, setBriefing] = useState<DailyBriefingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getDailyBriefing()
      .then(setBriefing)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalReview = briefing?.review_items?.length ?? 0;
  const totalNew = briefing?.new_items?.length ?? 0;
  const totalItems = totalReview + totalNew;

  const handleReviewPress = (item: BriefingItem) => {
    if (onReviewItem) {
      onReviewItem(item);
      return;
    }
    navigation.navigate("主导航", {
      screen: "聊天",
      params: { prompt: `复习一下「${item.concept}」` },
    });
  };

  const handleNewPress = (item: BriefingItem) => {
    if (onNewItem) {
      onNewItem(item);
      return;
    }
    navigation.navigate("主导航", {
      screen: "聊天",
      params: { prompt: `我想学习「${item.concept}」` },
    });
  };

  const handleQuizPress = (item: BriefingItem) => {
    if (onQuizSuggestion) {
      onQuizSuggestion(item);
      return;
    }
    navigation.navigate("主导航", {
      screen: "测验",
      params: { concept: item.concept },
    });
  };

  if (loading) {
    return (
      <View style={styles.collapsedContainer}>
        <ActivityIndicator size="small" color={colors.brand} />
        <Text style={styles.collapsedText}>加载今日简报...</Text>
      </View>
    );
  }

  if (!briefing || totalItems === 0) {
    return null;
  }

  // ── 折叠态 ─────────────────────────────────────────────
  if (!expanded) {
    return (
      <Pressable
        style={styles.collapsedContainer}
        onPress={() => setExpanded(true)}
      >
        <Ionicons name="today-outline" size={18} color={colors.brand} />
        <Text style={styles.collapsedText}>
          今日简报：{totalItems}项待学习
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={colors.stone400}
        />
      </Pressable>
    );
  }

  // ── 展开态 ─────────────────────────────────────────────
  return (
    <View style={styles.expandedContainer}>
      {/* 头部 */}
      <View style={styles.expandedHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{briefing.greeting}</Text>
        </View>
        <Pressable onPress={() => setExpanded(false)} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.stone400} />
        </Pressable>
      </View>

      {/* 待复习 */}
      {totalReview > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <Ionicons name="refresh-outline" size={14} color={colors.brand} />
            {"  "}待复习 ({totalReview})
          </Text>
          <View style={styles.itemWrap}>
            {briefing.review_items.map((item, i) => (
              <Pressable
                key={`review-${i}`}
                style={styles.reviewChip}
                onPress={() => handleReviewPress(item)}
              >
                <Text style={styles.reviewChipText}>{item.concept}</Text>
                <Text style={styles.chipMinutes}>~{item.est_minutes}分钟</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* 新学内容 */}
      {totalNew > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <Ionicons name="sparkles-outline" size={14} color={colors.stone600} />
            {"  "}新学内容 ({totalNew})
          </Text>
          <View style={styles.itemWrap}>
            {briefing.new_items.map((item, i) => (
              <Pressable
                key={`new-${i}`}
                style={styles.newChip}
                onPress={() => handleNewPress(item)}
              >
                <Text style={styles.newChipText}>{item.concept}</Text>
                <Text style={styles.chipMinutes}>~{item.est_minutes}分钟</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* 测验建议 */}
      {briefing.quiz_suggestion && (
        <Pressable
          style={styles.quizBtn}
          onPress={() => {
            if (briefing.quiz_suggestion) {
              handleQuizPress(briefing.quiz_suggestion);
            }
          }}
        >
          <Ionicons name="school-outline" size={18} color={colors.white} />
          <Text style={styles.quizBtnText}>
            建议测验：{briefing.quiz_suggestion.concept}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── 样式 ────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── 折叠态 ──────────────
  collapsedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  collapsedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.stone700,
  },

  // ── 展开态 ──────────────
  expandedContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: "hidden",
  },
  expandedHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
    lineHeight: 22,
  },

  // ── 段落 ────────────────
  section: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone500,
    marginBottom: 8,
  },
  itemWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  // ── 复习标签 ────────────
  reviewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(198, 122, 74, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(198, 122, 74, 0.25)",
  },
  reviewChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.brand,
  },

  // ── 新学标签 ────────────
  newChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.stone100,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  newChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.stone700,
  },

  chipMinutes: {
    fontSize: 11,
    color: colors.stone400,
  },

  // ── 测验按钮 ────────────
  quizBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.stone800,
  },
  quizBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
});
