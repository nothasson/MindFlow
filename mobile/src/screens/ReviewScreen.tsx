import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import type { ReviewItem } from "../lib/types";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function ReviewScreen() {
  const navigation = useNavigation<any>();
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [due, upcoming] = await Promise.all([
        api.getReviewDue(),
        api.getReviewUpcoming(),
      ]);
      setDueItems(due);
      setUpcomingItems(upcoming);
    } catch {
      setDueItems([]);
      setUpcomingItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartReview = useCallback(() => {
    if (dueItems.length > 0) {
      navigation.navigate("ReviewSession");
    }
  }, [dueItems.length, navigation]);

  const handleReviewItem = useCallback(
    (item: ReviewItem) => {
      navigation.navigate("ReviewSession", { concept: item.concept });
    },
    [navigation]
  );

  const calendarDays = useMemo(() => {
    const totalDays = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfWeek(calYear, calMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  const reviewDates = useMemo(() => {
    const dates = new Set<string>();
    [...dueItems, ...upcomingItems].forEach((item) => {
      if (item.next_review) {
        const date = new Date(item.next_review);
        dates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      }
    });
    return dates;
  }, [dueItems, upcomingItems]);

  const isToday = (day: number) =>
    calYear === today.getFullYear() &&
    calMonth === today.getMonth() &&
    day === today.getDate();

  const hasReview = (day: number) =>
    reviewDates.has(`${calYear}-${calMonth}-${day}`);

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
        <Text style={styles.headerTitle}>复习计划</Text>
        <Text style={styles.headerSubtitle}>先处理今天到期的内容，再安排接下来几天的节奏</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() => {
                if (calMonth === 0) {
                  setCalYear((value) => value - 1);
                  setCalMonth(11);
                } else {
                  setCalMonth((value) => value - 1);
                }
              }}
              style={styles.calNavBtn}
            >
              <Text style={styles.calNavText}>‹</Text>
            </Pressable>
            <Text style={styles.calTitle}>
              {calYear}年 {calMonth + 1}月
            </Text>
            <Pressable
              onPress={() => {
                if (calMonth === 11) {
                  setCalYear((value) => value + 1);
                  setCalMonth(0);
                } else {
                  setCalMonth((value) => value + 1);
                }
              }}
              style={styles.calNavBtn}
            >
              <Text style={styles.calNavText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} style={styles.weekCell}>
                <Text style={styles.weekText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((day, index) => (
              <View key={index} style={styles.dayCell}>
                {day != null ? (
                  <View
                    style={[
                      styles.dayInner,
                      isToday(day) && styles.dayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday(day) && styles.dayTodayText,
                      ]}
                    >
                      {day}
                    </Text>
                    {hasReview(day) ? (
                      <View
                        style={[
                          styles.dayDot,
                          isToday(day) && styles.dayDotToday,
                        ]}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日复习</Text>
          <Text style={styles.sectionCount}>{dueItems.length} 项</Text>
        </View>

        {dueItems.length > 0 ? (
          <>
            <Pressable style={styles.startBtn} onPress={handleStartReview}>
              <Text style={styles.startBtnText}>
                开始复习（{dueItems.length} 个知识点）
              </Text>
            </Pressable>

            {dueItems.map((item) => (
              <Pressable
                key={item.id ?? item.concept}
                style={styles.reviewCard}
                onPress={() => handleReviewItem(item)}
              >
                <View style={styles.reviewCardLeft}>
                  <Text style={styles.reviewCardConcept} numberOfLines={1}>
                    {item.concept}
                  </Text>
                  <Text style={styles.reviewCardMeta}>
                    掌握度 {Math.round(item.confidence * 100)}% · 间隔 {item.interval_days} 天
                  </Text>
                </View>
                <Text style={styles.reviewCardAction}>单独复习</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>暂无到期的复习项</Text>
            <Text style={styles.emptySubtext}>今天的复习已经完成，继续保持节奏。</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>即将到期</Text>
          <Text style={styles.sectionCount}>未来 7 天 · {upcomingItems.length} 项</Text>
        </View>

        {upcomingItems.length > 0 ? (
          upcomingItems.map((item) => {
            const reviewDate = new Date(item.next_review);
            const diffDays = Math.ceil(
              (reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <View key={item.id ?? `${item.concept}-upcoming`} style={styles.upcomingCard}>
                <View style={styles.upcomingLeft}>
                  <Text style={styles.upcomingConcept} numberOfLines={1}>
                    {item.concept}
                  </Text>
                  <Text style={styles.upcomingMeta}>
                    {reviewDate.toLocaleDateString("zh-CN")} 到期
                  </Text>
                </View>
                <View style={styles.upcomingBadge}>
                  <Text style={styles.upcomingBadgeText}>
                    {diffDays <= 0 ? "今天" : `${diffDays} 天后`}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>未来 7 天暂无到期项</Text>
            <Text style={styles.emptySubtext}>复习节奏看起来比较健康。</Text>
          </View>
        )}
      </ScrollView>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.stone100,
    alignItems: "center",
    justifyContent: "center",
  },
  calNavText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.stone600,
  },
  calTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone800,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.stone400,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayToday: {
    backgroundColor: colors.brand,
  },
  dayText: {
    fontSize: 14,
    color: colors.stone700,
  },
  dayTodayText: {
    color: colors.white,
    fontWeight: "700",
  },
  dayDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  dayDotToday: {
    backgroundColor: colors.white,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.stone400,
  },
  startBtn: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  startBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
  },
  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewCardLeft: {
    flex: 1,
  },
  reviewCardConcept: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
    marginBottom: 4,
  },
  reviewCardMeta: {
    fontSize: 12,
    color: colors.stone400,
  },
  reviewCardAction: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  upcomingCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  upcomingLeft: {
    flex: 1,
  },
  upcomingConcept: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
    marginBottom: 4,
  },
  upcomingMeta: {
    fontSize: 12,
    color: colors.stone400,
  },
  upcomingBadge: {
    borderRadius: 999,
    backgroundColor: colors.stone100,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.stone600,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone600,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.stone400,
    textAlign: "center",
  },
});
