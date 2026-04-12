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
import type { Course, CourseSection } from "../lib/types";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "初学",
  intermediate: "进阶",
  advanced: "高级",
};

export function CourseDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const courseId = route.params?.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
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

  const handleStartChat = () => {
    const prompt = course
      ? `我想学习课程「${course.title}」，请帮我梳理重点知识点。`
      : "我想开始课程学习";
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
        <Text style={styles.headerTitle}>{course.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 课程概览 */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <View style={styles.difficultyTag}>
              <Text style={styles.difficultyText}>
                {DIFFICULTY_LABELS[course.difficulty_level] ?? course.difficulty_level}
              </Text>
            </View>
          </View>
          {course.summary ? (
            <Text style={styles.courseSummary}>{course.summary}</Text>
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
                      {section.title}
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</Text>
                </Pressable>

                {isExpanded && (
                  <View style={styles.sectionBody}>
                    {section.summary ? (
                      <Text style={styles.sectionSummary}>{section.summary}</Text>
                    ) : null}

                    {section.learning_objectives ? (
                      <View style={styles.objectivesBox}>
                        <Text style={styles.objectivesLabel}>学习目标</Text>
                        <Text style={styles.objectivesText}>
                          {section.learning_objectives}
                        </Text>
                      </View>
                    ) : null}

                    {section.content ? (
                      <Text style={styles.sectionContent}>{section.content}</Text>
                    ) : null}

                    {section.question_prompts ? (
                      <View style={styles.promptsBox}>
                        <Text style={styles.promptsLabel}>思考与讨论</Text>
                        <Text style={styles.promptsText}>
                          {section.question_prompts}
                        </Text>
                      </View>
                    ) : null}

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

        {/* 进入对话学习 */}
        <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
          <Text style={styles.chatButtonText}>进入对话学习</Text>
        </TouchableOpacity>
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
  courseSummary: {
    fontSize: 14,
    color: colors.stone600,
    lineHeight: 20,
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
  sectionSummary: {
    fontSize: 13,
    color: colors.stone500,
    lineHeight: 19,
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
  objectivesText: {
    fontSize: 13,
    color: colors.stone600,
    lineHeight: 19,
  },
  sectionContent: {
    fontSize: 14,
    color: colors.stone800,
    lineHeight: 22,
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
  promptsText: {
    fontSize: 13,
    color: colors.stone700,
    lineHeight: 19,
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

  // Chat button
  chatButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  chatButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
