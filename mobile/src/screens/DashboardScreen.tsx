import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { DashboardStats } from "../lib/types";

export function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {stats ? (
          <>
            <View style={styles.cardRow}>
              <StatCard label="知识点" value={stats.total_concepts} color={colors.brand} />
              <StatCard label="已掌握" value={stats.mastered_concepts} color={colors.success} />
            </View>
            <View style={styles.cardRow}>
              <StatCard label="薄弱点" value={stats.weak_concepts} color={colors.warning} />
              <StatCard label="连续天数" value={stats.streak_days} color={colors.info} />
            </View>
            <View style={styles.cardRow}>
              <StatCard label="今日学习(分钟)" value={stats.today_minutes} color={colors.brand} />
              <StatCard label="总对话数" value={stats.total_conversations} color={colors.stone600} />
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>暂无学习数据</Text>
            <Text style={styles.emptySubtext}>开始聊天学习后，数据将在这里展示</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.stone500,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone600,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.stone400,
  },
});
