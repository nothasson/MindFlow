import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import * as api from "../lib/api";
import type {
  KnowledgeNode,
  QuizQuestion,
  QuizSubmitResult,
} from "../lib/types";

// ===== 类型定义 =====

type QuizMode = "traditional" | "anki" | "conversation";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const TAB_LABELS: Record<QuizMode, string> = {
  traditional: "传统问答",
  anki: "闪卡模式",
  conversation: "对话评估",
};

// ===== 主屏幕 =====

export function QuizScreen() {
  const route = useRoute<any>();
  const routeConcept = route.params?.concept as string | undefined;
  const [mode, setMode] = useState<QuizMode>("traditional");
  const [concepts, setConcepts] = useState<KnowledgeNode[]>([]);
  const [weakConcepts, setWeakConcepts] = useState<string[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const graph = await api.getKnowledgeGraph().catch(() => ({ nodes: [], edges: [] }));
        if (cancelled) return;
        setConcepts(graph.nodes);
        // 按 confidence 升序取薄弱概念
        const sorted = [...graph.nodes].sort(
          (a, b) => a.confidence - b.confidence
        );
        setWeakConcepts(sorted.slice(0, 5).map((n) => n.concept));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingConcepts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>知识测验</Text>
      </View>

      {/* Tab 切换 */}
      <View style={styles.tabRow}>
        {(["traditional", "anki", "conversation"] as QuizMode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.tab, mode === m && styles.tabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
              {TAB_LABELS[m]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadingConcepts ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>加载知识点...</Text>
        </View>
      ) : (
        <>
          {mode === "traditional" && (
            <TraditionalMode
              concepts={concepts}
              weakConcepts={weakConcepts}
              initialConcept={routeConcept}
            />
          )}
          {mode === "anki" && (
            <AnkiMode
              concepts={concepts}
              weakConcepts={weakConcepts}
              initialConcept={routeConcept}
            />
          )}
          {mode === "conversation" && (
            <ConversationMode
              concepts={concepts}
              weakConcepts={weakConcepts}
              initialConcept={routeConcept}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ===== 概念选择器 =====

function ConceptSelector({
  concepts,
  weakConcepts,
  selectedConcept,
  onSelect,
}: {
  concepts: KnowledgeNode[];
  weakConcepts: string[];
  selectedConcept: string;
  onSelect: (concept: string) => void;
}) {
  const [input, setInput] = useState("");
  const suggestedConcepts =
    weakConcepts.length > 0
      ? weakConcepts
      : concepts.slice(0, 8).map((item) => item.concept);
  const allConcepts = concepts.map((item) => item.concept);

  if (concepts.length === 0) {
    return (
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>输入概念名称</Text>
        <TextInput
          style={styles.textInput}
          placeholder="请输入要测验的概念..."
          placeholderTextColor={colors.stone400}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => {
            if (input.trim()) {
              onSelect(input.trim());
              setInput("");
            }
          }}
          returnKeyType="done"
        />
      </View>
    );
  }

  return (
    <View style={styles.selectorContainer}>
      {suggestedConcepts.length > 0 && (
        <>
          <Text style={styles.selectorLabel}>推荐知识点</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipContainer}
          >
            {suggestedConcepts.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.chip,
                  selectedConcept === c && styles.chipActive,
                ]}
                onPress={() => onSelect(c)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedConcept === c && styles.chipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      <Text style={[styles.selectorLabel, { marginTop: 8 }]}>
        全部概念
      </Text>
      <View style={styles.allConceptWrap}>
        {allConcepts.map((concept) => (
          <Pressable
            key={concept}
            style={[
              styles.compactChip,
              selectedConcept === concept && styles.compactChipActive,
            ]}
            onPress={() => onSelect(concept)}
          >
            <Text
              style={[
                styles.compactChipText,
                selectedConcept === concept && styles.compactChipTextActive,
              ]}
            >
              {concept}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.selectorLabel, { marginTop: 12 }]}>
        手动输入概念
      </Text>
      <TextInput
        style={styles.textInput}
        placeholder="或输入其他概念名称..."
        placeholderTextColor={colors.stone400}
        value={input}
        onChangeText={setInput}
        onSubmitEditing={() => {
          if (input.trim()) {
            onSelect(input.trim());
            setInput("");
          }
        }}
        returnKeyType="done"
      />
    </View>
  );
}

// ===== 传统问答模式 =====

function TraditionalMode({
  concepts,
  weakConcepts,
  initialConcept,
}: {
  concepts: KnowledgeNode[];
  weakConcepts: string[];
  initialConcept?: string;
}) {
  const [selectedConcept, setSelectedConcept] = useState(
    initialConcept ?? weakConcepts[0] ?? ""
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    if (initialConcept) {
      setSelectedConcept(initialConcept);
    } else if (!selectedConcept && weakConcepts[0]) {
      setSelectedConcept(weakConcepts[0]);
    }
  }, [initialConcept, selectedConcept, weakConcepts]);

  const handleGenerate = useCallback(async () => {
    if (!selectedConcept) return;
    setLoading(true);
    setError("");
    setQuestions([]);
    setCurrentIndex(0);
    setResult(null);
    setAnswer("");
    try {
      const qs = await api.generateQuiz(selectedConcept, 3);
      if (qs.length === 0) {
        setError("未能生成测验题目，请尝试其他概念");
      } else {
        setQuestions(qs);
      }
    } catch (e: any) {
      setError(e?.message || "生成测验失败");
    } finally {
      setLoading(false);
    }
  }, [selectedConcept]);

  const handleSubmit = useCallback(async () => {
    if (!currentQuestion || !answer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.submitQuiz(
        currentQuestion.concept,
        currentQuestion.question,
        answer.trim()
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "提交答案失败");
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, answer]);

  const handleNext = useCallback(() => {
    setResult(null);
    setAnswer("");
    setCurrentIndex((i) => i + 1);
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollFill}
        contentContainerStyle={styles.modeContent}
        keyboardShouldPersistTaps="handled"
      >
        <ConceptSelector
          concepts={concepts}
          weakConcepts={weakConcepts}
          selectedConcept={selectedConcept}
          onSelect={setSelectedConcept}
        />

        {/* 生成按钮 */}
        {questions.length === 0 && (
          <Pressable
            style={[
              styles.primaryButton,
              (!selectedConcept || loading) && styles.buttonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={!selectedConcept || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>生成测验</Text>
            )}
          </Pressable>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 题目卡片 */}
        {currentQuestion && !result && (
          <View style={styles.card}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                第 {currentIndex + 1} / {questions.length} 题
              </Text>
              {currentQuestion.difficulty && (
                <View style={styles.difficultyBadge}>
                  <Text style={styles.difficultyText}>
                    {currentQuestion.difficulty}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.questionSection}>
              <MarkdownRenderer content={currentQuestion.question} />
            </View>
            <TextInput
              style={[styles.textInput, styles.answerInput]}
              placeholder="输入你的答案..."
              placeholderTextColor={colors.stone400}
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              style={[
                styles.primaryButton,
                (!answer.trim() || submitting) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!answer.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>提交答案</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* 结果卡片 */}
        {result && (
          <View style={styles.card}>
            <View
              style={[
                styles.resultBanner,
                result.correct ? styles.resultCorrect : styles.resultWrong,
              ]}
            >
              <Text style={styles.resultIcon}>
                {result.correct ? "✓" : "✗"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultLabel}>
                  {result.correct ? "回答正确" : "回答错误"}
                </Text>
                <Text style={styles.resultScore}>
                  得分：{result.score} / 100
                </Text>
              </View>
            </View>

            {result.error_type && (
              <View style={styles.errorTypeBadge}>
                <Text style={styles.errorTypeText}>
                  错误类型：{result.error_type}
                </Text>
              </View>
            )}

            <Text style={styles.explanationTitle}>详细解释</Text>
            <MarkdownRenderer content={result.explanation} />

            {currentIndex < questions.length - 1 ? (
              <Pressable style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>下一题</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, styles.secondaryButton]}
                onPress={() => {
                  setQuestions([]);
                  setCurrentIndex(0);
                  setResult(null);
                  setAnswer("");
                }}
              >
                <Text style={styles.secondaryButtonText}>重新开始</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 空态 */}
        {questions.length === 0 && !loading && !error && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>选择概念并生成测验</Text>
            <Text style={styles.emptySubtext}>
              系统将根据你的知识薄弱点生成针对性题目
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ===== Anki 闪卡模式 =====

function AnkiMode({
  concepts,
  weakConcepts,
  initialConcept,
}: {
  concepts: KnowledgeNode[];
  weakConcepts: string[];
  initialConcept?: string;
}) {
  // 用待复习的概念构建卡组
  const [cardConcepts, setCardConcepts] = useState<KnowledgeNode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState(
    initialConcept ?? weakConcepts[0] ?? ""
  );
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentCard = cardConcepts[currentIndex] ?? null;
  const finished = started && currentIndex >= cardConcepts.length;

  useEffect(() => {
    if (initialConcept) {
      setSelectedConcept(initialConcept);
    } else if (!selectedConcept && weakConcepts[0]) {
      setSelectedConcept(weakConcepts[0]);
    }
  }, [initialConcept, selectedConcept, weakConcepts]);

  const handleStart = useCallback(() => {
    // 使用所有概念或按选中筛选
    let cards: KnowledgeNode[];
    if (selectedConcept) {
      // 选中具体概念时，只展示该概念
      cards = concepts.filter((n) => n.concept === selectedConcept);
      if (cards.length === 0) {
        // 手动输入的概念，创建虚拟卡
        cards = [
          {
            id: "manual",
            concept: selectedConcept,
            confidence: 0,
            easiness_factor: 2.5,
            interval_days: 0,
            repetitions: 0,
            last_reviewed: "",
            next_review: "",
            description: "",
          },
        ];
      }
    } else {
      // 未选择时，按置信度升序取前10个薄弱概念
      cards = [...concepts]
        .sort((a, b) => a.confidence - b.confidence)
        .slice(0, 10);
    }

    if (cards.length === 0) {
      setError("没有可用的闪卡，请先学习一些知识点");
      return;
    }

    setCardConcepts(cards);
    setCurrentIndex(0);
    setFlipped(false);
    setStarted(true);
    setError("");
  }, [concepts, weakConcepts, selectedConcept]);

  const handleRate = useCallback(
    async (ratingValue: number) => {
      if (!currentCard || rating) return;
      setRating(true);
      try {
        await api.quizAnkiRate(currentCard.concept, ratingValue);
      } catch {
        // 静默处理
      } finally {
        setRating(false);
        setFlipped(false);
        setCurrentIndex((i) => i + 1);
      }
    },
    [currentCard, rating]
  );

  if (!started) {
    return (
      <ScrollView
        style={styles.scrollFill}
        contentContainerStyle={styles.modeContent}
      >
        <ConceptSelector
          concepts={concepts}
          weakConcepts={weakConcepts}
          selectedConcept={selectedConcept}
          onSelect={setSelectedConcept}
        />
        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>开始闪卡</Text>
        </Pressable>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🗂️</Text>
            <Text style={styles.emptyText}>Anki 闪卡复习</Text>
            <Text style={styles.emptySubtext}>
              查看概念正面，翻转查看详情，然后根据掌握程度评分
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  if (finished) {
    return (
      <ScrollView
        style={styles.scrollFill}
        contentContainerStyle={styles.modeContent}
      >
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyText}>本轮闪卡已完成</Text>
          <Text style={styles.emptySubtext}>
            共复习了 {cardConcepts.length} 张卡片
          </Text>
        </View>
        <Pressable
          style={[styles.primaryButton, styles.secondaryButton]}
          onPress={() => {
            setStarted(false);
            setCardConcepts([]);
            setCurrentIndex(0);
          }}
        >
          <Text style={styles.secondaryButtonText}>返回选择</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.ankiContainer}>
      {/* 进度 */}
      <View style={styles.ankiProgress}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {cardConcepts.length}
        </Text>
      </View>

      {/* 闪卡 */}
      <Pressable
        style={styles.flashcard}
        onPress={() => setFlipped((f) => !f)}
      >
        {!flipped ? (
          <View style={styles.flashcardInner}>
            <Text style={styles.flashcardLabel}>概念</Text>
            <Text style={styles.flashcardConcept}>
              {currentCard?.concept}
            </Text>
            <Text style={styles.flashcardHint}>点击翻转查看详情</Text>
          </View>
        ) : (
          <View style={styles.flashcardInner}>
            <Text style={styles.flashcardLabel}>详情</Text>
            <ScrollView style={{ flex: 1, width: "100%" }}>
              {currentCard?.description ? (
                <MarkdownRenderer content={currentCard.description} />
              ) : (
                <Text style={styles.flashcardDescription}>
                  暂无详细描述
                </Text>
              )}
              <View style={styles.flashcardMeta}>
                <Text style={styles.metaText}>
                  掌握度：{Math.round((currentCard?.confidence ?? 0) * 100)}%
                </Text>
                <Text style={styles.metaText}>
                  复习次数：{currentCard?.repetitions ?? 0}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Pressable>

      {/* FSRS 评分按钮 */}
      {flipped && (
        <View style={styles.ratingRow}>
          <Pressable
            style={[styles.ratingButton, { backgroundColor: colors.error }]}
            onPress={() => handleRate(1)}
            disabled={rating}
          >
            <Text style={styles.ratingButtonText}>重来</Text>
            <Text style={styles.ratingNumber}>1</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, { backgroundColor: colors.warning }]}
            onPress={() => handleRate(2)}
            disabled={rating}
          >
            <Text style={styles.ratingButtonText}>困难</Text>
            <Text style={styles.ratingNumber}>2</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, { backgroundColor: colors.info }]}
            onPress={() => handleRate(3)}
            disabled={rating}
          >
            <Text style={styles.ratingButtonText}>良好</Text>
            <Text style={styles.ratingNumber}>3</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingButton, { backgroundColor: colors.success }]}
            onPress={() => handleRate(4)}
            disabled={rating}
          >
            <Text style={styles.ratingButtonText}>轻松</Text>
            <Text style={styles.ratingNumber}>4</Text>
          </Pressable>
        </View>
      )}

      {rating && (
        <ActivityIndicator
          size="small"
          color={colors.brand}
          style={{ marginTop: 8 }}
        />
      )}
    </View>
  );
}

// ===== 对话评估模式 =====

function ConversationMode({
  concepts,
  weakConcepts,
  initialConcept,
}: {
  concepts: KnowledgeNode[];
  weakConcepts: string[];
  initialConcept?: string;
}) {
  const [selectedConcept, setSelectedConcept] = useState(
    initialConcept ?? weakConcepts[0] ?? ""
  );
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finalScore, setFinalScore] = useState<number | undefined>();
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (initialConcept) {
      setSelectedConcept(initialConcept);
    } else if (!selectedConcept && weakConcepts[0]) {
      setSelectedConcept(weakConcepts[0]);
    }
  }, [initialConcept, selectedConcept, weakConcepts]);

  const handleStart = useCallback(async () => {
    if (!selectedConcept) return;
    setSending(true);
    setError("");
    setMessages([]);
    setSessionId(undefined);
    setFinished(false);
    setFinalScore(undefined);
    try {
      const res = await api.quizConversation(selectedConcept, "开始评估", undefined);
      setSessionId(res.session_id);
      setMessages([{ role: "assistant", content: res.message }]);
      setStarted(true);
      if (res.finished) {
        setFinished(true);
        setFinalScore(res.score);
      }
    } catch (e: any) {
      setError(e?.message || "开始对话评估失败");
    } finally {
      setSending(false);
    }
  }, [selectedConcept]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || finished) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    setError("");
    try {
      const res = await api.quizConversation(
        selectedConcept,
        text,
        sessionId
      );
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.message },
      ]);
      if (res.finished) {
        setFinished(true);
        setFinalScore(res.score);
      }
    } catch (e: any) {
      setError(e?.message || "发送消息失败");
    } finally {
      setSending(false);
    }
  }, [input, sending, finished, selectedConcept, sessionId]);

  // 自动滚动
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (!started) {
    return (
      <ScrollView
        style={styles.scrollFill}
        contentContainerStyle={styles.modeContent}
      >
        <ConceptSelector
          concepts={concepts}
          weakConcepts={weakConcepts}
          selectedConcept={selectedConcept}
          onSelect={setSelectedConcept}
        />
        <Pressable
          style={[
            styles.primaryButton,
            (!selectedConcept || sending) && styles.buttonDisabled,
          ]}
          onPress={handleStart}
          disabled={!selectedConcept || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>开始对话评估</Text>
          )}
        </Pressable>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>苏格拉底式对话评估</Text>
            <Text style={styles.emptySubtext}>
              通过多轮对话深入评估你对概念的理解程度
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={styles.scrollFill}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            {item.role === "assistant" ? (
              <MarkdownRenderer content={item.content} />
            ) : (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
          </View>
        )}
        ListFooterComponent={
          <>
            {sending && (
              <View style={[styles.messageBubble, styles.assistantBubble]}>
                <ActivityIndicator size="small" color={colors.brand} />
              </View>
            )}
            {finished && finalScore !== undefined && (
              <View style={styles.scoreCard}>
                <Text style={styles.scoreTitle}>评估完成</Text>
                <Text
                  style={[
                    styles.scoreValue,
                    {
                      color:
                        finalScore >= 80
                          ? colors.success
                          : finalScore >= 60
                          ? colors.warning
                          : colors.error,
                    },
                  ]}
                >
                  {finalScore}
                </Text>
                <Text style={styles.scoreLabel}>分</Text>
                <Pressable
                  style={[styles.primaryButton, styles.secondaryButton, { marginTop: 12 }]}
                  onPress={() => {
                    setStarted(false);
                    setMessages([]);
                    setSessionId(undefined);
                    setFinished(false);
                    setFinalScore(undefined);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>重新开始</Text>
                </Pressable>
              </View>
            )}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        }
      />

      {/* 输入区 */}
      {!finished && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.chatInput}
            placeholder="输入你的回答..."
            placeholderTextColor={colors.stone400}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            editable={!sending}
            returnKeyType="send"
          />
          <Pressable
            style={[
              styles.sendButton,
              (!input.trim() || sending) && styles.buttonDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  // 布局
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollFill: {
    flex: 1,
  },
  modeContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },

  // 头部
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

  // Tab
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.stone100,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone600,
  },
  tabTextActive: {
    color: "#fff",
  },

  // 加载
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.stone500,
  },

  // 概念选择
  selectorContainer: {
    gap: 6,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone600,
  },
  chipScroll: {
    maxHeight: 44,
  },
  chipContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  allConceptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.stone100,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    color: colors.stone700,
  },
  chipTextActive: {
    color: "#fff",
  },
  compactChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  compactChipActive: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderColor: "rgba(198, 122, 74, 0.22)",
  },
  compactChipText: {
    fontSize: 13,
    color: colors.stone600,
  },
  compactChipTextActive: {
    color: colors.brand,
    fontWeight: "600",
  },

  // 输入框
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone800,
  },
  answerInput: {
    minHeight: 100,
    marginBottom: 12,
  },

  // 按钮
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: colors.stone100,
    borderWidth: 1,
    borderColor: colors.stone300,
  },
  secondaryButtonText: {
    color: colors.stone700,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // 卡片
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 12,
  },

  // 进度
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone500,
  },
  difficultyBadge: {
    backgroundColor: colors.stone100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    color: colors.stone600,
  },

  // 问题
  questionSection: {
    paddingVertical: 4,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.stone800,
    fontWeight: "500",
  },

  // 结果
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  resultCorrect: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  resultWrong: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  resultIcon: {
    fontSize: 28,
    fontWeight: "700",
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },
  resultScore: {
    fontSize: 13,
    color: colors.stone600,
    marginTop: 2,
  },
  errorTypeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  errorTypeText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: "500",
  },
  explanationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone700,
  },

  // 空态
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 4,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone600,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.stone400,
    textAlign: "center",
    lineHeight: 20,
  },

  // 错误
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },

  // Anki 闪卡
  ankiContainer: {
    flex: 1,
    padding: 16,
  },
  ankiProgress: {
    alignItems: "center",
    marginBottom: 12,
  },
  flashcard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.stone200,
    overflow: "hidden",
  },
  flashcardInner: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  flashcardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.stone400,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  flashcardConcept: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.stone800,
    textAlign: "center",
  },
  flashcardHint: {
    fontSize: 13,
    color: colors.stone400,
    marginTop: 20,
  },
  flashcardDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.stone600,
    textAlign: "center",
  },
  flashcardMeta: {
    marginTop: 16,
    gap: 4,
    alignItems: "center",
  },
  metaText: {
    fontSize: 13,
    color: colors.stone500,
  },

  // FSRS 评分按钮
  ratingRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  ratingButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  ratingButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  ratingNumber: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 2,
  },

  // 对话模式
  messageBubble: {
    maxWidth: "85%",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.stone800,
  },

  // 评分卡
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.stone600,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "700",
    color: colors.brand,
  },
  scoreLabel: {
    fontSize: 14,
    color: colors.stone500,
    marginTop: -4,
  },

  // 输入栏
  inputBar: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    backgroundColor: colors.background,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.stone800,
  },
  sendButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
