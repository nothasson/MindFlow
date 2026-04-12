import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import { fillTemplate } from "../lib/api";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import type { Course, CourseSection } from "../lib/types";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "初学",
  intermediate: "进阶",
  advanced: "高级",
};

/** 安全解码 URL 编码 */
function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** 从课程 summary 中提取简短摘要（到第一个 --- 分割线或前 300 字） */
function extractBrief(summary: string): string {
  // 取 ## 课程摘要 之后到第一个 --- 之间的内容
  const parts = summary.split(/\n---\n/);
  const first = parts[0] || summary;
  // 去掉 Markdown 标题行，只保留正文
  const lines = first.split("\n").filter(l => !l.startsWith("## ") && !l.startsWith("### "));
  const text = lines.join("\n").trim();
  return text.length > 300 ? text.slice(0, 300) + "..." : text;
}

export function CourseDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const courseId = route.params?.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [templates, setTemplates] = useState<api.PromptTemplates>({});

  useEffect(() => {
    api.getPromptTemplates().then(setTemplates).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const data = await api.getCourse(courseId);
      setCourse(data.course);
      setSections(data.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载课程失败");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  /** 针对当前展开的章节进入对话学习 */
  const handleStartSectionChat = (sectionIdx: number) => {
    if (!course) return;
    const section = sections[sectionIdx];
    const tpl = templates.learn_course_section
      || "我想学习课程「{{course_title}}」的第 {{section_index}} 章「{{section_title}}」。\n\n学习目标：\n{{learning_objectives}}\n\n请用苏格拉底式对话引导我理解这些内容。";
    const prompt = fillTemplate(tpl, {
      course_title: decode(course.title),
      section_index: String(sectionIdx + 1),
      section_title: decode(section?.title || ""),
      learning_objectives: section?.learning_objectives || "无",
    });
    navigation.navigate("主导航", {
      screen: "聊天",
      params: { prompt },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !course) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>课程详情</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "课程不存在"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{decode(course.title)}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 课程概览 */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.courseTitle}>{decode(course.title)}</Text>
            <View style={styles.difficultyTag}>
              <Text style={styles.difficultyText}>
                {DIFFICULTY_LABELS[course.difficulty_level] ?? course.difficulty_level}
              </Text>
            </View>
          </View>
          {course.summary ? (
            <Text style={styles.courseBrief}>{extractBrief(course.summary)}</Text>
          ) : null}
          <View style={styles.courseMeta}>
            <Text style={styles.metaText}>
              {course.section_count} 个章节
            </Text>
          </View>
        </View>

        {/* 章节列表（手风琴） */}
        {sections.length > 0 ? (
          sections.map((section, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <View key={section.id} style={styles.sectionCard}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => setExpandedIndex(isExpanded ? -1 : idx)}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <View style={styles.sectionNumber}>
                      <Text style={styles.sectionNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.sectionTitle} numberOfLines={2}>
                      {decode(section.title)}
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
                </Pressable>

                {isExpanded && (
                  <View style={styles.sectionBody}>
                    {section.summary ? (
                      <MarkdownRenderer content={section.summary} />
                    ) : null}

                    {section.learning_objectives ? (
                      <View style={styles.objectivesBox}>
                        <Text style={styles.objectivesLabel}>学习目标</Text>
                        <MarkdownRenderer content={section.learning_objectives} />
                      </View>
                    ) : null}

                    {section.content ? (
                      <MarkdownRenderer content={section.content} />
                    ) : null}

                    {section.question_prompts ? (
                      <View style={styles.promptsBox}>
                        <Text style={styles.promptsLabel}>思考与讨论</Text>
                        <MarkdownRenderer content={section.question_prompts} />
                      </View>
                    ) : null}

                    {/* 本章对话学习按钮 */}
                    <TouchableOpacity
                      style={styles.sectionChatButton}
                      onPress={() => handleStartSectionChat(idx)}
                    >
                      <Text style={styles.sectionChatButtonText}>
                        对话学习本章：{decode(section.title)}
                      </Text>
                    </TouchableOpacity>

                    {/* 章节导航 */}
                    <View style={styles.sectionNav}>
                      {idx > 0 ? (
                        <TouchableOpacity
                          style={styles.navButtonSecondary}
                          onPress={() => setExpandedIndex(idx - 1)}
                        >
                          <Text style={styles.navButtonSecondaryText}>
                            上一章
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View />
                      )}
                      {idx < sections.length - 1 ? (
                        <TouchableOpacity
                          style={styles.navButtonPrimary}
                          onPress={() => setExpandedIndex(idx + 1)}
                        >
                          <Text style={styles.navButtonPrimaryText}>
                            下一章
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View />
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>课程暂无章节内容</Text>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(214, 211, 209, 0.4)",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 24,
    color: colors.stone800,
    lineHeight: 28,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.stone800,
  },
  headerSpacer: {
    width: 36,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // Overview
  overviewCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 10,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  courseTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: colors.stone800,
    lineHeight: 26,
  },
  courseBrief: {
    fontSize: 14,
    color: colors.stone600,
    lineHeight: 20,
  },
  difficultyTag: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  courseMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaText: {
    fontSize: 13,
    color: colors.stone500,
  },

  // Section card (accordion)
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionNumberText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.white,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
    lineHeight: 20,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.stone400,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  objectivesBox: {
    backgroundColor: colors.stone50,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  objectivesLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone700,
  },
  promptsBox: {
    backgroundColor: "rgba(198, 122, 74, 0.06)",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(198, 122, 74, 0.15)",
  },
  promptsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },

  // 本章对话学习按钮
  sectionChatButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  sectionChatButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },

  sectionNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  navButtonSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navButtonSecondaryText: {
    fontSize: 13,
    color: colors.stone600,
    fontWeight: "600",
  },
  navButtonPrimary: {
    borderRadius: 10,
    backgroundColor: colors.stone800,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navButtonPrimaryText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: "600",
  },

  // Empty
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  emptyText: {
    fontSize: 14,
    color: colors.stone500,
  },
});
