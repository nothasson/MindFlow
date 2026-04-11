import React, { useCallback, useEffect, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { ReviewItem, QuizQuestion, QuizSubmitResult } from "../lib/types";

// ===== 阶段定义 =====

type SessionPhase = "loading" | "question" | "graded" | "rating" | "complete";

interface SessionStats {
  total: number;
  correct: number;
  scores: number[];
}

// ===== FSRS 评分按钮 =====

const FSRS_BUTTONS: { rating: number; label: string; color: string }[] = [
  { rating: 1, label: "重来", color: colors.error },
  { rating: 2, label: "困难", color: colors.warning },
  { rating: 3, label: "良好", color: colors.brand },
  { rating: 4, label: "轻松", color: colors.success },
];

// ===== 主屏幕 =====

export function ReviewSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialConcept = route.params?.concept as string | undefined;

  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(
    null
  );
  const [answer, setAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState<QuizSubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    total: 0,
    correct: 0,
    scores: [],
  });

  // 加载待复习项并生成第一题
  const initialize = useCallback(async () => {
    setPhase("loading");
    try {
      let items: ReviewItem[];
      if (initialConcept) {
        // 单个概念复习
        const all = await api.getReviewDue();
        const found = all.find((i) => i.concept === initialConcept);
        items = found ? [found] : [{ concept: initialConcept, confidence: 0, interval_days: 0, next_review: "", easiness_factor: 2.5, repetitions: 0 }];
      } else {
        items = await api.getReviewDue();
      }

      if (items.length === 0) {
        setReviewItems([]);
        setPhase("complete");
        return;
      }

      setReviewItems(items);
      setCurrentIndex(0);
      await loadQuestion(items[0].concept);
    } catch {
      setReviewItems([]);
      setPhase("complete");
    }
  }, [initialConcept]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // 为某个概念生成题目
  const loadQuestion = async (concept: string) => {
    setPhase("loading");
    setAnswer("");
    setGradeResult(null);
    try {
      const questions = await api.generateQuiz(concept, 1);
      if (questions.length > 0) {
        setCurrentQuestion(questions[0]);
        setPhase("question");
      } else {
        // 无法生成题目，跳到下一个
        handleNextAfterRate();
      }
    } catch {
      // 生成失败，跳过
      handleNextAfterRate();
    }
  };

  // 提交答案
  const handleSubmit = async () => {
    if (!currentQuestion || !answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.submitQuiz(
        currentQuestion.concept,
        currentQuestion.question,
        answer.trim()
      );
      setGradeResult(result);
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        correct: prev.correct + (result.correct ? 1 : 0),
        scores: [...prev.scores, result.score],
      }));
      setPhase("rating");
    } catch {
      // 提交失败
    } finally {
      setSubmitting(false);
    }
  };

  // FSRS 评分
  const handleRate = async (rating: number) => {
    if (!currentQuestion) return;
    try {
      await api.quizAnkiRate(currentQuestion.concept, rating);
    } catch {
      // 静默处理
    }
    handleNextAfterRate();
  };

  // 进入下一题或完成
  const handleNextAfterRate = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < reviewItems.length) {
      setCurrentIndex(nextIdx);
      loadQuestion(reviewItems[nextIdx].concept);
    } else {
      setPhase("complete");
    }
  };

  // 返回
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // 进度百分比
  const progress =
    reviewItems.length > 0
      ? ((currentIndex + (phase === "complete" ? 0 : 0)) / reviewItems.length) *
        100
      : 0;

  // ===== 渲染 =====

  // 加载中
  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>正在准备题目...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 完成页面
  if (phase === "complete") {
    const avgScore =
      stats.scores.length > 0
        ? Math.round(
            stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
          )
        : 0;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={handleGoBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </Pressable>
        </View>
        <View style={styles.completeContainer}>
          <Text style={styles.completeIcon}>🎉</Text>
          <Text style={styles.completeTitle}>复习完成！</Text>

          {stats.total > 0 ? (
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.brand }]}>
                    {stats.total}
                  </Text>
                  <Text style={styles.statLabel}>总题数</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {stats.correct}
                  </Text>
                  <Text style={styles.statLabel}>正确数</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          avgScore >= 80
                            ? colors.success
                            : avgScore >= 60
                            ? colors.warning
                            : colors.error,
                      },
                    ]}
                  >
                    {avgScore}%
                  </Text>
                  <Text style={styles.statLabel}>平均分</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.completeSubtext}>暂无待复习的内容</Text>
          )}

          <Pressable style={styles.primaryBtn} onPress={handleGoBack}>
            <Text style={styles.primaryBtnText}>返回复习计划</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 答题 / 评分阶段
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header + 进度 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleGoBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </Pressable>
          <Text style={styles.progressLabel}>
            {currentIndex + 1} / {reviewItems.length}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(
                  ((currentIndex + 1) / reviewItems.length) * 100,
                  100
                )}%`,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 概念标签 */}
        <View style={styles.conceptBadge}>
          <Text style={styles.conceptBadgeText}>
            {currentQuestion?.concept}
          </Text>
        </View>

        {/* 问题卡片 */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>问题</Text>
          <Text style={styles.questionText}>
            {currentQuestion?.question}
          </Text>
        </View>

        {/* 答案输入（答题阶段） */}
        {phase === "question" && (
          <>
            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>你的回答</Text>
              <TextInput
                style={styles.answerInput}
                placeholder="在此输入你的答案..."
                placeholderTextColor={colors.stone400}
                multiline
                value={answer}
                onChangeText={setAnswer}
                textAlignVertical="top"
              />
            </View>
            <Pressable
              style={[
                styles.primaryBtn,
                (!answer.trim() || submitting) && styles.primaryBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!answer.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>提交答案</Text>
              )}
            </Pressable>
          </>
        )}

        {/* 评分结果 + FSRS（评分阶段） */}
        {phase === "rating" && gradeResult && (
          <>
            {/* 结果卡片 */}
            <View
              style={[
                styles.resultCard,
                {
                  borderColor: gradeResult.correct
                    ? colors.success
                    : colors.error,
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultIcon}>
                  {gradeResult.correct ? "✅" : "❌"}
                </Text>
                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color: gradeResult.correct
                        ? colors.success
                        : colors.error,
                    },
                  ]}
                >
                  {gradeResult.correct ? "回答正确" : "回答有误"}
                </Text>
                <View
                  style={[
                    styles.scoreBadge,
                    {
                      backgroundColor: gradeResult.correct
                        ? colors.success
                        : colors.error,
                    },
                  ]}
                >
                  <Text style={styles.scoreBadgeText}>
                    {gradeResult.score}分
                  </Text>
                </View>
              </View>
              <Text style={styles.resultExplanation}>
                {gradeResult.explanation}
              </Text>
            </View>

            {/* 你的回答 */}
            <View style={styles.answerReviewCard}>
              <Text style={styles.answerReviewLabel}>你的回答</Text>
              <Text style={styles.answerReviewText}>{answer}</Text>
            </View>

            {/* FSRS 评分 */}
            <View style={styles.fsrsCard}>
              <Text style={styles.fsrsTitle}>你觉得这道题的难度如何？</Text>
              <View style={styles.fsrsRow}>
                {FSRS_BUTTONS.map((btn) => (
                  <Pressable
                    key={btn.rating}
                    style={[
                      styles.fsrsBtn,
                      { backgroundColor: btn.color },
                    ]}
                    onPress={() => handleRate(btn.rating)}
                  >
                    <Text style={styles.fsrsBtnText}>{btn.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.stone500,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(214, 211, 209, 0.4)",
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.brand,
    fontWeight: "600",
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone600,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.stone200,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // Concept Badge
  conceptBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(198, 122, 74, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  conceptBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },

  // Question
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.stone500,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.stone800,
  },

  // Answer Input
  answerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.stone500,
    marginBottom: 8,
  },
  answerInput: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.stone800,
    minHeight: 100,
    padding: 0,
  },

  // Primary Button
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },

  // Result Card
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultIcon: {
    fontSize: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  scoreBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  resultExplanation: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.stone700,
  },

  // Answer Review
  answerReviewCard: {
    backgroundColor: colors.stone100,
    borderRadius: 16,
    padding: 16,
  },
  answerReviewLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.stone500,
    marginBottom: 6,
  },
  answerReviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.stone700,
  },

  // FSRS
  fsrsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  fsrsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone700,
    textAlign: "center",
    marginBottom: 12,
  },
  fsrsRow: {
    flexDirection: "row",
    gap: 8,
  },
  fsrsBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  fsrsBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },

  // Complete
  completeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  completeIcon: {
    fontSize: 48,
    marginBottom: 4,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.stone800,
  },
  completeSubtext: {
    fontSize: 15,
    color: colors.stone500,
    textAlign: "center",
  },
  statsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: colors.stone200,
    marginVertical: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 13,
    color: colors.stone500,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.stone200,
  },
});
