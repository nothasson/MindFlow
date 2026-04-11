import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import { getTeachingStyle, setTeachingStyle } from "../lib/storage";
import { useAuthStore } from "../stores/authStore";
import type {
  ExamPlan,
  KnowledgeNode,
  LLMProvider,
} from "../lib/types";

// ─── 教学风格 ────────────────────────────────────────────

interface StyleOption {
  key: string;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    key: "socratic",
    label: "苏格拉底",
    desc: "引导式提问，启发思考",
    icon: "help-circle-outline",
  },
  {
    key: "lecture",
    label: "讲解",
    desc: "原理深入讲解，系统学习",
    icon: "book-outline",
  },
  {
    key: "analogy",
    label: "类比",
    desc: "现实类比帮助理解",
    icon: "bulb-outline",
  },
];

// ─── 工具函数 ────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysColor(days: number): string {
  if (days <= 7) return colors.error;
  if (days <= 30) return colors.warning;
  return colors.success;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── 组件 ────────────────────────────────────────────────

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { logout, user } = useAuthStore();

  // 教学风格
  const [style, setStyle] = useState("socratic");

  // LLM 提供者
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);

  // 考试计划
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [concepts, setConcepts] = useState<KnowledgeNode[]>([]);
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // ─── 加载数据 ──────────────────────────────────────────

  useEffect(() => {
    getTeachingStyle().then((s) => {
      if (s) setStyle(s);
    });
  }, []);

  const loadProviders = useCallback(() => {
    setProviderLoading(true);
    api
      .getProviderSettings()
      .then((data) => {
        setProviders(data.providers);
        setActiveProvider(data.active);
      })
      .catch(() => {})
      .finally(() => setProviderLoading(false));
  }, []);

  const loadPlans = useCallback(() => {
    setPlansLoading(true);
    api
      .getExamPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    loadProviders();
    loadPlans();
    api.getKnowledgeGraph().then((g) => setConcepts(g.nodes)).catch(() => {});
  }, [loadProviders, loadPlans]);

  // ─── 操作 ──────────────────────────────────────────────

  const handleStyleChange = async (key: string) => {
    setStyle(key);
    await setTeachingStyle(key);
  };

  const handleProviderChange = async (name: string) => {
    try {
      setActiveProvider(name);
      await api.setProvider(name);
    } catch {
      loadProviders();
    }
  };

  const handleDeletePlan = (plan: ExamPlan) => {
    Alert.alert("删除考试计划", `确定删除「${plan.title}」吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteExamPlan(plan.id);
            setPlans((prev) => prev.filter((p) => p.id !== plan.id));
          } catch {
            Alert.alert("删除失败", "请稍后重试");
          }
        },
      },
    ]);
  };

  const handleCreatePlan = async () => {
    if (!newTitle.trim()) {
      Alert.alert("提示", "请输入考试标题");
      return;
    }
    setCreating(true);
    try {
      const plan = await api.createExamPlan({
        title: newTitle.trim(),
        exam_date: formatDate(newDate),
        concepts: selectedConcepts,
      });
      setPlans((prev) => [...prev, plan]);
      setNewTitle("");
      setNewDate(new Date());
      setSelectedConcepts([]);
      setShowNewPlan(false);
    } catch {
      Alert.alert("创建失败", "请稍后重试");
    } finally {
      setCreating(false);
    }
  };

  const toggleConcept = (concept: string) => {
    setSelectedConcepts((prev) =>
      prev.includes(concept)
        ? prev.filter((c) => c !== concept)
        : [...prev, concept]
    );
  };

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) setNewDate(date);
  };

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => logout() },
    ]);
  };

  // ─── 渲染 ──────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>设置</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>常用入口</Text>
        <View style={styles.quickGrid}>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.getParent()?.navigate("学习数据")}
          >
            <Ionicons name="bar-chart-outline" size={22} color={colors.brand} />
            <Text style={styles.quickTitle}>学习数据</Text>
            <Text style={styles.quickDesc}>看趋势、热力图和薄弱点</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.getParent()?.navigate("错题本")}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.brand} />
            <Text style={styles.quickTitle}>错题本</Text>
            <Text style={styles.quickDesc}>集中复盘易错知识点</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.getParent()?.navigate("学习历程")}
          >
            <Ionicons name="time-outline" size={22} color={colors.brand} />
            <Text style={styles.quickTitle}>学习历程</Text>
            <Text style={styles.quickDesc}>回看最近对话和学习日历</Text>
          </Pressable>
        </View>

        {/* ── 教学风格 ──────────────────────── */}
        <Text style={styles.sectionTitle}>教学风格</Text>
        <View style={styles.card}>
          {STYLE_OPTIONS.map((opt) => {
            const active = style === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[
                  styles.styleRow,
                  active && styles.styleRowActive,
                ]}
                onPress={() => handleStyleChange(opt.key)}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={active ? colors.brand : colors.stone400}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.styleLabel,
                      active && { color: colors.brand },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.styleDesc}>{opt.desc}</Text>
                </View>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.brand}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── LLM 提供者 ──────────────────── */}
        <Text style={styles.sectionTitle}>LLM 提供者</Text>
        <View style={styles.card}>
          {providerLoading ? (
            <ActivityIndicator
              color={colors.brand}
              style={{ paddingVertical: 16 }}
            />
          ) : providers.length === 0 ? (
            <Text style={styles.emptyText}>暂无可用提供者</Text>
          ) : (
            providers.map((p) => {
              const active = p.name === activeProvider;
              return (
                <Pressable
                  key={p.name}
                  style={[styles.providerRow, active && styles.providerRowActive]}
                  onPress={() => handleProviderChange(p.name)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.providerName,
                        active && { color: colors.brand, fontWeight: "600" },
                      ]}
                    >
                      {p.name}
                    </Text>
                    <Text style={styles.providerModel}>{p.model}</Text>
                  </View>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.brand}
                    />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── 考试计划 ──────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>考试计划</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => setShowNewPlan(!showNewPlan)}
          >
            <Ionicons
              name={showNewPlan ? "close" : "add"}
              size={20}
              color={colors.brand}
            />
          </Pressable>
        </View>

        {/* 新建表单 */}
        {showNewPlan && (
          <View style={styles.card}>
            <Text style={styles.formLabel}>考试标题</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="例如：期末考试"
              placeholderTextColor={colors.stone400}
            />

            <Text style={styles.formLabel}>考试日期</Text>
            <Pressable
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.stone500}
              />
              <Text style={styles.dateBtnText}>{formatDate(newDate)}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={newDate}
                mode="date"
                minimumDate={new Date()}
                onChange={handleDateChange}
                display={Platform.OS === "ios" ? "inline" : "default"}
              />
            )}

            {concepts.length > 0 && (
              <>
                <Text style={styles.formLabel}>关联概念</Text>
                <View style={styles.conceptWrap}>
                  {concepts.map((c) => {
                    const sel = selectedConcepts.includes(c.concept);
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.conceptChip,
                          sel && styles.conceptChipActive,
                        ]}
                        onPress={() => toggleConcept(c.concept)}
                      >
                        <Text
                          style={[
                            styles.conceptChipText,
                            sel && styles.conceptChipTextActive,
                          ]}
                        >
                          {c.concept}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Pressable
              style={[styles.createBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreatePlan}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.createBtnText}>创建计划</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* 已有计划列表 */}
        <View style={styles.card}>
          {plansLoading ? (
            <ActivityIndicator
              color={colors.brand}
              style={{ paddingVertical: 16 }}
            />
          ) : plans.length === 0 ? (
            <Text style={styles.emptyText}>暂无考试计划</Text>
          ) : (
            plans.map((plan) => {
              const days = daysUntil(plan.exam_date);
              return (
                <View key={plan.id} style={styles.planRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planDate}>
                      考试日期：{plan.exam_date}
                    </Text>
                  </View>
                  <View style={styles.planRight}>
                    <Text
                      style={[styles.planDays, { color: daysColor(days) }]}
                    >
                      {days > 0 ? `${days}天` : "已到期"}
                    </Text>
                    <Pressable
                      onPress={() => handleDeletePlan(plan)}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.stone400}
                      />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── 关于 / 退出 ──────────────────── */}
        <Text style={styles.sectionTitle}>其他</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={colors.stone500}
            />
            <Text style={styles.aboutText}>{user?.display_name || user?.email || "未登录"}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={colors.stone500}
            />
            <Text style={styles.aboutText}>MindFlow v1.0.0</Text>
          </View>
          <Text style={styles.aboutDesc}>
            AI 苏格拉底式学习系统 — 通过对话、知识图谱和遗忘曲线帮助你高效学习
          </Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 样式 ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickCard: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 8,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.stone800,
  },
  quickDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.stone500,
  },

  // ── Section ────────────────
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone600,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
    marginRight: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: "hidden",
  },

  // ── 教学风格 ────────────────
  styleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  styleRowActive: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    backgroundColor: "rgba(198, 122, 74, 0.05)",
  },
  styleLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.stone800,
  },
  styleDesc: {
    fontSize: 12,
    color: colors.stone400,
    marginTop: 2,
  },

  // ── LLM 提供者 ──────────────
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  providerRowActive: {
    backgroundColor: "rgba(198, 122, 74, 0.05)",
  },
  providerName: {
    fontSize: 15,
    color: colors.stone800,
  },
  providerModel: {
    fontSize: 12,
    color: colors.stone400,
    marginTop: 2,
  },

  // ── 考试计划 ────────────────
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(198, 122, 74, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.stone800,
  },
  planDate: {
    fontSize: 12,
    color: colors.stone400,
    marginTop: 2,
  },
  planRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  planDays: {
    fontSize: 14,
    fontWeight: "700",
  },

  // ── 新建表单 ────────────────
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone600,
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  input: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone800,
    backgroundColor: colors.stone50,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.stone50,
  },
  dateBtnText: {
    fontSize: 15,
    color: colors.stone800,
  },
  conceptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
  },
  conceptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stone300,
    backgroundColor: colors.stone50,
  },
  conceptChipActive: {
    borderColor: colors.brand,
    backgroundColor: "rgba(198, 122, 74, 0.1)",
  },
  conceptChipText: {
    fontSize: 13,
    color: colors.stone600,
  },
  conceptChipTextActive: {
    color: colors.brand,
    fontWeight: "500",
  },
  createBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  createBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },

  // ── 关于 ────────────────────
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.stone100,
  },
  aboutText: {
    fontSize: 15,
    color: colors.stone700,
  },
  aboutDesc: {
    fontSize: 12,
    color: colors.stone400,
    paddingHorizontal: 16,
    paddingVertical: 12,
    lineHeight: 18,
  },

  // ── 退出登录 ────────────────
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.error,
  },

  // ── 通用 ────────────────────
  emptyText: {
    fontSize: 14,
    color: colors.stone400,
    textAlign: "center",
    paddingVertical: 20,
  },
});
