import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useChatStore } from "../stores/chatStore";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type {
  CalendarDay,
  MemorySearchResult,
  RecentConversation,
  RecentKnowledge,
} from "../lib/types";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function formatRelativeTime(value: string): string {
  if (value.includes("刚刚") || value.includes("分钟前") || value.includes("小时前") || value.includes("天前")) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return colors.success;
  if (confidence >= 0.3) return colors.warning;
  return colors.error;
}

function calendarLevelColor(count: number): string {
  if (count === 0) return colors.stone200;
  if (count <= 5) return "rgba(198, 122, 74, 0.25)";
  if (count <= 15) return "rgba(198, 122, 74, 0.5)";
  if (count <= 30) return "rgba(198, 122, 74, 0.75)";
  return colors.brand;
}

export function MemoryScreen() {
  const navigation = useNavigation<any>();
  const { selectConversation } = useChatStore();

  const [knowledge, setKnowledge] = useState<RecentKnowledge | null>(null);
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getRecentKnowledge().catch(() => null),
      api.getRecentConversations().catch(() => []),
      api.getStatsCalendar().catch(() => []),
    ])
      .then(([k, c, cal]) => {
        if (!cancelled) {
          setKnowledge(k);
          setConversations(c as RecentConversation[]);
          setCalendar(cal as CalendarDay[]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const results = await api.searchMemory(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      await selectConversation(conversationId);
      navigation.navigate("主导航", {
        screen: "聊天",
        params: { conversationId },
      });
    },
    [navigation, selectConversation]
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
        <Text style={styles.headerTitle}>学习历程</Text>
        <Text style={styles.headerSubtitle}>回看最近学过的概念、对话记录和活跃日期</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <KnowledgeSummary knowledge={knowledge} />
        <RecentConcepts concepts={knowledge?.recent ?? []} />
        <RecentConversationsList
          conversations={conversations}
          onPress={openConversation}
        />
        <CalendarHeatmap calendar={calendar} />
        <MemorySearch
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          onSearch={handleSearch}
          searching={searching}
          hasSearched={hasSearched}
          results={searchResults}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function KnowledgeSummary({
  knowledge,
}: {
  knowledge: RecentKnowledge | null;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>知识进度</Text>
      <View style={styles.summaryRow}>
        <SummaryCard
          label="新学习"
          value={knowledge?.new ?? 0}
          color={colors.info}
          bgColor="rgba(59, 130, 246, 0.1)"
        />
        <SummaryCard
          label="巩固中"
          value={knowledge?.learning ?? 0}
          color={colors.warning}
          bgColor="rgba(245, 158, 11, 0.1)"
        />
        <SummaryCard
          label="已掌握"
          value={knowledge?.mastered ?? 0}
          color={colors.success}
          bgColor="rgba(34, 197, 94, 0.1)"
        />
      </View>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </View>
  );
}

function RecentConcepts({
  concepts,
}: {
  concepts: { concept: string; confidence: number }[];
}) {
  if (concepts.length === 0) {
    return (
      <SectionCard title="最近概念" emptyText="暂无学习概念" />
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>最近概念</Text>
      <View style={styles.card}>
        {concepts.map((item, index) => (
          <View
            key={item.concept}
            style={[
              styles.conceptRow,
              index < concepts.length - 1 && styles.divider,
            ]}
          >
            <Text style={styles.conceptName} numberOfLines={1}>
              {item.concept}
            </Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(item.confidence * 100)}%`,
                      backgroundColor: confidenceColor(item.confidence),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentConversationsList({
  conversations,
  onPress,
}: {
  conversations: RecentConversation[];
  onPress: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <SectionCard title="最近对话" emptyText="暂无对话记录" />
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>最近对话</Text>
      <View style={styles.card}>
        {conversations.map((conv, index) => (
          <Pressable
            key={conv.id}
            style={[
              styles.conversationRow,
              index < conversations.length - 1 && styles.divider,
            ]}
            onPress={() => onPress(conv.id)}
          >
            <View style={styles.conversationInfo}>
              <Text style={styles.conversationTitle} numberOfLines={1}>
                {conv.title || "未命名对话"}
              </Text>
              {conv.last_message ? (
                <Text style={styles.conversationSnippet} numberOfLines={1}>
                  {conv.last_message}
                </Text>
              ) : null}
              <Text style={styles.conversationMeta}>
                {conv.message_count} 条消息 · {formatRelativeTime(conv.updated_at)}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CalendarHeatmap({ calendar }: { calendar: CalendarDay[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of calendar) {
      map[item.date] = item.count;
    }
    return map;
  }, [calendar]);

  const getCount = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return countMap[dateStr] ?? 0;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>学习日历</Text>
      <View style={styles.card}>
        <Text style={styles.calendarMonth}>
          {year}年{month + 1}月
        </Text>
        <View style={styles.calendarWeekRow}>
          {WEEKDAY_LABELS.map((label) => (
            <View key={label} style={styles.calendarCellWrapper}>
              <Text style={styles.calendarWeekLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {grid.map((day, index) => (
            <View key={index} style={styles.calendarCellWrapper}>
              {day != null ? (
                <View
                  style={[
                    styles.calendarCell,
                    { backgroundColor: calendarLevelColor(getCount(day)) },
                  ]}
                >
                  <Text style={styles.calendarDayText}>{day}</Text>
                </View>
              ) : (
                <View style={styles.calendarCellEmpty} />
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function MemorySearch({
  query,
  onChangeQuery,
  onSearch,
  searching,
  hasSearched,
  results,
}: {
  query: string;
  onChangeQuery: (q: string) => void;
  onSearch: () => void;
  searching: boolean;
  hasSearched: boolean;
  results: MemorySearchResult[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>记忆搜索</Text>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索对话历史..."
          placeholderTextColor={colors.stone400}
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <Pressable
          style={[
            styles.searchButton,
            !query.trim() && styles.searchButtonDisabled,
          ]}
          onPress={onSearch}
          disabled={!query.trim()}
        >
          {searching ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.searchButtonText}>搜索</Text>
          )}
        </Pressable>
      </View>

      {hasSearched ? (
        <View style={styles.card}>
          {results.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>未找到相关记录</Text>
            </View>
          ) : (
            results.map((item, index) => (
              <View
                key={`${item.source}-${index}`}
                style={[
                  styles.searchResultRow,
                  index < results.length - 1 && styles.divider,
                ]}
              >
                <Text style={styles.searchResultSource}>{item.source}</Text>
                <Text style={styles.searchResultContent}>{item.content}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

function SectionCard({
  title,
  emptyText,
}: {
  title: string;
  emptyText: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      </View>
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
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: "hidden",
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.stone400,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  conceptRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  conceptName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.stone800,
    marginRight: 12,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 130,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.stone200,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    width: 40,
    fontSize: 12,
    color: colors.stone500,
    textAlign: "right",
    fontWeight: "600",
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 8,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.stone800,
    marginBottom: 3,
  },
  conversationSnippet: {
    fontSize: 12,
    color: colors.stone500,
    marginBottom: 3,
  },
  conversationMeta: {
    fontSize: 12,
    color: colors.stone400,
  },
  chevron: {
    fontSize: 20,
    color: colors.stone400,
  },
  calendarMonth: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone700,
    textAlign: "center",
    paddingTop: 14,
    paddingBottom: 8,
  },
  calendarWeekRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  calendarWeekLabel: {
    fontSize: 12,
    color: colors.stone400,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  calendarCellWrapper: {
    width: "14.28%",
    alignItems: "center",
    marginBottom: 6,
  },
  calendarCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCellEmpty: {
    width: 34,
    height: 34,
  },
  calendarDayText: {
    fontSize: 12,
    color: colors.stone700,
  },
  searchBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 14,
    color: colors.stone800,
    backgroundColor: colors.white,
  },
  searchButton: {
    minWidth: 72,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
  },
  searchButtonDisabled: {
    backgroundColor: colors.stone300,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
  searchResultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchResultSource: {
    fontSize: 12,
    color: colors.stone400,
    marginBottom: 4,
  },
  searchResultContent: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.stone700,
  },
});
