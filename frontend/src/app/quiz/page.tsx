"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { ChatInput } from "@/components/chat/ChatInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface WeakPoint {
  concept: string;
  confidence: number;
}

// 对话考察消息
interface ConvMessage {
  role: "ai" | "user";
  content: string;
}

// 错题本相关类型
interface WrongBookEntry {
  id: string;
  quiz_attempt_id: string;
  concept: string;
  error_type: string;
  question: string;
  user_answer: string;
  reviewed: boolean;
  review_count: number;
  next_review?: string;
  created_at: string;
}

interface WrongBookStat {
  error_type: string;
  count: number;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  knowledge_gap: "知识遗漏",
  concept_confusion: "概念混淆",
  concept_error: "概念错误",
  method_error: "方法错误",
  calculation_error: "计算错误",
  overconfidence: "过度自信",
  strategy_error: "策略错误",
  unclear_expression: "表述不清",
};

// 将题目按 "参考思路" 分割为问题和答案两部分（Anki 正反面）
function splitQuestionAndAnswer(text: string): { question: string; answer: string } {
  const markers = ["**参考思路**", "参考思路：", "**参考思路：**"];
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > 0) {
      return {
        question: text.slice(0, idx).trim(),
        answer: text.slice(idx).trim(),
      };
    }
  }
  // 没找到分隔符，整段作为问题
  return { question: text, answer: "（请根据自己的理解自评掌握程度）" };
}

export default function QuizPage() {
  const searchParams = useSearchParams();
  const urlConcept = searchParams?.get("concept") ?? "";

  // tab 切换：出题测验 | 错题本
  const [activeTab, setActiveTab] = useState<"quiz" | "wrongbook">("quiz");

  const [concept, setConcept] = useState(urlConcept);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ score: number; is_correct: boolean; explanation?: string } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 薄弱知识点列表（自动推荐用）
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [loadingWeak, setLoadingWeak] = useState(true);

  // 对话考察模式
  const [convMode, setConvMode] = useState(false);
  const [convMessages, setConvMessages] = useState<ConvMessage[]>([]);
  const [convInput, setConvInput] = useState("");
  const [convSessionId, setConvSessionId] = useState("");

  // Anki 卡片模式
  const [ankiMode, setAnkiMode] = useState(false);
  const [ankiCards, setAnkiCards] = useState<string[]>([]);
  const [ankiIndex, setAnkiIndex] = useState(0);
  const [ankiFlipped, setAnkiFlipped] = useState(false);
  const [ankiScores, setAnkiScores] = useState<number[]>([]);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [convFinished, setConvFinished] = useState(false);
  const [convRound, setConvRound] = useState(0);

  // 错题本状态
  const [wbEntries, setWbEntries] = useState<WrongBookEntry[]>([]);
  const [wbStats, setWbStats] = useState<WrongBookStat[]>([]);
  const [wbLoading, setWbLoading] = useState(false);
  const [wbFilter, setWbFilter] = useState<string>("all");
  const [wbExpandedIds, setWbExpandedIds] = useState<Set<string>>(new Set());
  const [wbLoaded, setWbLoaded] = useState(false); // 标记是否已加载过，避免重复请求

  // 进入页面时自动加载薄弱知识点
  useEffect(() => {
    if (urlConcept) {
      setConcept(urlConcept);
      setLoadingWeak(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/dashboard/stats`);
        if (!res.ok) throw new Error("获取失败");
        const data = await res.json();
        const points: WeakPoint[] = (data.weak_points ?? []).map((p: { concept: string; confidence: number }) => ({
          concept: p.concept,
          confidence: p.confidence,
        }));
        setWeakPoints(points);
        // 自动选择最薄弱的概念
        if (points.length > 0) {
          setConcept(points[0].concept);
        }
      } catch {
        // 获取失败不阻塞页面
      } finally {
        setLoadingWeak(false);
      }
    })();
  }, [urlConcept]);

  // 切换到错题本 tab 时加载数据
  const fetchWrongBook = useCallback(async () => {
    setWbLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/wrongbook`),
        fetch(`${API_URL}/api/wrongbook/stats`),
      ]);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setWbEntries(data.entries ?? []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setWbStats(data.stats ?? []);
      }
      setWbLoaded(true);
    } catch {
      // 静默失败
    } finally {
      setWbLoading(false);
    }
  }, []);

  // 切到错题本 tab 时自动拉取数据
  useEffect(() => {
    if (activeTab === "wrongbook" && !wbLoaded) {
      fetchWrongBook();
    }
  }, [activeTab, wbLoaded, fetchWrongBook]);

  // 错题本：展开/收起
  const wbToggleExpand = (id: string) => {
    setWbExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 错题本：标记已复习
  const wbMarkReviewed = async (id: string) => {
    await fetch(`${API_URL}/api/wrongbook/${id}/review`, { method: "POST" });
    fetchWrongBook();
  };

  // 错题本：删除
  const wbDeleteEntry = async (id: string) => {
    await fetch(`${API_URL}/api/wrongbook/${id}`, { method: "DELETE" });
    fetchWrongBook();
  };

  // 解析 LLM 返回的多题文本为单题数组
  const parseQuestions = (text: string): string[] => {
    const parts = text.split(/(?=###\s*题目|(?:^|\n)\*\*题目)/);
    const filtered = parts.filter((p) => p.trim().length > 20);
    return filtered.length > 0 ? filtered : [text];
  };

  const generateQuiz = useCallback(async () => {
    if (!concept) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept }),
      });
      if (!res.ok) throw new Error("出题失败");
      const data = await res.json();
      const parsed = parseQuestions(data.questions);
      setQuestions(parsed);
      setCurrentIndex(0);
      setScores([]);
      setFinished(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "出题失败");
    } finally {
      setLoading(false);
    }
  }, [concept]);

  const submitAnswer = useCallback(async () => {
    if (!answer.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          question: questions[currentIndex]?.slice(0, 500) ?? "",
          answer,
        }),
      });
      if (!res.ok) throw new Error("提交失败");
      const data = await res.json();
      setResult(data);
      setScores((prev) => [...prev, data.score]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }, [concept, questions, currentIndex, answer, submitting]);

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setResult(null);
    }
  };

  const resetQuiz = () => {
    setQuestions([]);
    setScores([]);
    setAnswer("");
    setResult(null);
    setFinished(false);
  };

  const switchConcept = (newConcept: string) => {
    setConcept(newConcept);
    resetQuiz();
  };

  // 对话考察：开始
  const startConversation = async () => {
    if (!concept) return;
    setConvMode(true);
    setConvMessages([]);
    setConvFinished(false);
    setConvRound(0);
    setConvInput("");
    setError(null);

    // 生成唯一会话 ID
    const sid = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConvSessionId(sid);

    // 发起第一轮（空 message，触发 AI 出第一个问题）
    setConvLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/quiz/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, message: "", session_id: sid }),
      });
      if (!res.ok) throw new Error("启动对话考察失败");
      const data = await res.json();
      setConvMessages([{ role: "ai", content: data.reply }]);
      setConvRound(data.round);
      setConvFinished(data.finished);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动对话考察失败");
      setConvMode(false);
    } finally {
      setConvLoading(false);
    }
  };

  // 对话考察：发送回答
  const sendConvMessage = async () => {
    if (!convInput.trim() || convLoading || convFinished) return;
    const userMsg = convInput.trim();
    setConvInput("");
    setConvMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setConvLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/quiz/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          message: userMsg,
          session_id: convSessionId,
        }),
      });
      if (!res.ok) throw new Error("发送失败");
      const data = await res.json();
      setConvMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
      setConvRound(data.round);
      setConvFinished(data.finished);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setConvLoading(false);
    }
  };

  // 退出对话考察
  const exitConversation = () => {
    setConvMode(false);
    setConvMessages([]);
    setConvFinished(false);
    setConvRound(0);
    setConvSessionId("");
  };

  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0";

  // 错题本：筛选后的列表
  const wbFiltered = wbFilter === "all"
    ? wbEntries
    : wbEntries.filter((e) => e.error_type === wbFilter);
  const wbTotalUnreviewed = wbEntries.filter((e) => !e.reviewed).length;

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <h1 className="mb-1 text-2xl font-semibold text-stone-800">测验</h1>

          {/* tab 切换：出题测验 | 错题本 */}
          <div className="mb-6 flex gap-4 border-b border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab("quiz")}
              className={activeTab === "quiz"
                ? "border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]"
                : "pb-2 text-sm text-stone-400 hover:text-stone-600"}
            >
              出题测验
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wrongbook")}
              className={activeTab === "wrongbook"
                ? "border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]"
                : "pb-2 text-sm text-stone-400 hover:text-stone-600"}
            >
              错题本
              {wbTotalUnreviewed > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#c07060] px-1 text-[10px] text-white">
                  {wbTotalUnreviewed}
                </span>
              )}
            </button>
          </div>

          {/* ==================== 错题本 tab ==================== */}
          {activeTab === "wrongbook" ? (
            <div>
              {wbLoading ? (
                <p className="text-sm text-stone-400">加载中...</p>
              ) : wbEntries.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
                  <p className="mb-2 text-stone-500">还没有错题记录</p>
                  <p className="mb-4 text-sm text-stone-400">完成测验后，答错的题目会自动收集到这里</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("quiz")}
                    className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
                  >
                    去做测验
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 待复习提示 */}
                  <p className="text-sm text-stone-500">
                    {wbTotalUnreviewed > 0 ? `${wbTotalUnreviewed} 道待复习` : "暂无待复习错题"}
                  </p>

                  {/* 错误类型筛选 */}
                  {wbStats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWbFilter("all")}
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          wbFilter === "all"
                            ? "border-[#C67A4A] bg-[#C67A4A]/10 text-[#C67A4A]"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        全部 ({wbEntries.length})
                      </button>
                      {wbStats.map((s) => (
                        <button
                          key={s.error_type}
                          type="button"
                          onClick={() => setWbFilter(s.error_type)}
                          className={`rounded-full border px-3 py-1 text-sm transition ${
                            wbFilter === s.error_type
                              ? "border-[#C67A4A] bg-[#C67A4A]/10 text-[#C67A4A]"
                              : "border-stone-200 text-stone-600 hover:border-stone-400"
                          }`}
                        >
                          {ERROR_TYPE_LABELS[s.error_type] ?? s.error_type} ({s.count})
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 错题列表 */}
                  {wbFiltered.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-2xl border bg-white p-5 ${
                        entry.reviewed ? "border-stone-100 opacity-60" : "border-stone-200"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-base font-semibold text-stone-800">{entry.concept}</span>
                        <span className="rounded-full bg-[#c07060]/10 px-2 py-0.5 text-xs text-[#c07060]">
                          {ERROR_TYPE_LABELS[entry.error_type] ?? entry.error_type}
                        </span>
                        {entry.reviewed && (
                          <span className="rounded-full bg-[#6b8e6b]/10 px-2 py-0.5 text-xs text-[#6b8e6b]">
                            已复习
                          </span>
                        )}
                      </div>
                      <p className="mb-3 text-xs text-stone-400">
                        {new Date(entry.created_at).toLocaleDateString("zh-CN")}
                        {entry.review_count > 0 && ` · 已复习 ${entry.review_count} 次`}
                      </p>

                      {/* 原题和回答 */}
                      {entry.question && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => wbToggleExpand(entry.id)}
                            className="mb-2 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                          >
                            <svg
                              className={`h-3 w-3 transition-transform ${wbExpandedIds.has(entry.id) ? "rotate-90" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {wbExpandedIds.has(entry.id) ? "收起详情" : "查看原题"}
                          </button>
                          {wbExpandedIds.has(entry.id) && (
                            <div className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
                              <div>
                                <span className="font-medium text-stone-600">原题：</span>
                                <div className="mt-1">
                                  <MarkdownRenderer content={entry.question} />
                                </div>
                              </div>
                              {entry.user_answer && (
                                <div>
                                  <span className="font-medium text-[#c07060]">我的回答：</span>
                                  <p className="mt-1 whitespace-pre-wrap text-stone-600">{entry.user_answer}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            // 切到测验 tab 并设置概念，直接开始练习
                            setConcept(entry.concept);
                            resetQuiz();
                            setActiveTab("quiz");
                          }}
                          className="rounded-lg bg-[#C67A4A] px-3 py-1.5 text-xs text-white transition hover:bg-[#b06a3a]"
                        >
                          练习巩固
                        </button>
                        {!entry.reviewed && (
                          <button
                            type="button"
                            onClick={() => wbMarkReviewed(entry.id)}
                            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition hover:bg-stone-100"
                          >
                            标记已复习
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => wbDeleteEntry(entry.id)}
                          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ==================== 出题测验 tab ==================== */
            <>
              {/* 对话考察模式 */}
              {convMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-stone-500">
                      对话考察：{concept}（第 {convRound} 轮）
                    </p>
                    <button
                      type="button"
                      onClick={exitConversation}
                      className="rounded-lg border border-stone-200 px-3 py-1 text-sm text-stone-600 transition hover:bg-stone-100"
                    >
                      退出考察
                    </button>
                  </div>

                  {/* 对话消息列表 */}
                  <div className="space-y-3">
                    {convMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl p-4 ${
                          msg.role === "ai"
                            ? "border border-stone-200 bg-white"
                            : "ml-8 border border-[#C67A4A]/20 bg-[#C67A4A]/5"
                        }`}
                      >
                        <p className="mb-1 text-[11px] font-medium text-stone-400">
                          {msg.role === "ai" ? "考察导师" : "我的回答"}
                        </p>
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    ))}
                    {convLoading && (
                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-sm text-stone-400">思考中...</p>
                      </div>
                    )}
                  </div>

                  {/* 输入框 — 复用主对话框组件 */}
                  {!convFinished ? (
                    <ChatInput
                      isLoading={convLoading}
                      onSend={async (content) => {
                        setConvInput(content);
                        // 直接调用发送逻辑
                        if (!content.trim() || convLoading || convFinished) return;
                        setConvMessages((prev) => [...prev, { role: "user", content }]);
                        setConvLoading(true);
                        setError(null);
                        try {
                          const res = await fetch(`${API_URL}/api/quiz/conversation`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              concept,
                              message: content,
                              round: convRound,
                              history: convMessages.map((m) => `${m.role === "ai" ? "导师" : "学生"}：${m.content}`).join("\n"),
                            }),
                          });
                          if (!res.ok) throw new Error("对话失败");
                          const data = await res.json();
                          setConvMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
                          setConvRound(data.round);
                          if (data.finished) setConvFinished(true);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "对话失败");
                        } finally {
                          setConvLoading(false);
                        }
                      }}
                    />
                  ) : (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
                      <p className="mb-3 text-sm text-stone-600">对话考察已完成</p>
                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={exitConversation}
                          className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]"
                        >
                          返回
                        </button>
                        <button
                          type="button"
                          onClick={startConversation}
                          className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                        >
                          重新考察
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : loadingWeak ? (
                <p className="text-sm text-stone-400">正在分析你的学习状态...</p>
              ) : !concept && weakPoints.length === 0 ? (
                /* 没有任何知识点 */
                <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
                  <p className="mb-2 text-stone-500">还没有知识点数据</p>
                  <p className="mb-4 text-sm text-stone-400">先去学习一些内容，AI 会自动记录你的知识点</p>
                  <Link
                    href="/"
                    className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
                  >
                    开始学习
                  </Link>
                </div>
              ) : questions.length === 0 && !finished ? (
                /* 准备阶段：展示 AI 推荐 + 可选列表 */
                <div className="space-y-6">
                  {/* AI 推荐卡片 */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="rounded-full bg-[#C67A4A]/10 px-3 py-1 text-xs font-medium text-[#C67A4A]">
                        AI 推荐
                      </span>
                      <span className="text-sm text-stone-500">
                        根据你的薄弱点自动选择
                      </span>
                    </div>
                    <p className="mb-1 text-lg font-semibold text-stone-800">{concept}</p>
                    {weakPoints.find((w) => w.concept === concept) && (
                      <p className="mb-4 text-sm text-stone-400">
                        掌握度 {Math.round((weakPoints.find((w) => w.concept === concept)?.confidence ?? 0) * 100)}%，需要巩固
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={generateQuiz}
                        disabled={loading || ankiLoading}
                        className="rounded-xl border-2 border-[#C67A4A] bg-[#C67A4A] p-3 text-center text-white transition hover:bg-[#b06a3a] disabled:bg-stone-400 disabled:border-stone-400"
                      >
                        <p className="text-lg">📝</p>
                        <p className="text-sm font-medium">{loading ? "出题中..." : "题目测验"}</p>
                        <p className="mt-0.5 text-[11px] opacity-80">AI 出题 + 评分解析</p>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          // Anki 模式使用独立 loading，不影响"题目测验"按钮
                          setAnkiLoading(true);
                          setError(null);
                          try {
                            const res = await fetch(`${API_URL}/api/quiz/generate`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ concept }),
                            });
                            if (!res.ok) throw new Error("出题失败");
                            const data = await res.json();
                            const parsed = parseQuestions(data.questions);
                            setAnkiMode(true);
                            setQuestions(parsed);
                            setAnkiIndex(0);
                            setAnkiFlipped(false);
                            setAnkiScores([]);
                            setFinished(false);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "出题失败");
                          } finally {
                            setAnkiLoading(false);
                          }
                        }}
                        disabled={ankiLoading || loading}
                        className="rounded-xl border-2 border-stone-300 bg-white p-3 text-center text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                      >
                        <p className="text-lg">🃏</p>
                        <p className="text-sm font-medium">{ankiLoading ? "出题中..." : "Anki 卡片"}</p>
                        <p className="mt-0.5 text-[11px] text-stone-400">翻卡自评 + FSRS</p>
                      </button>
                      <button
                        type="button"
                        onClick={startConversation}
                        disabled={convLoading || !concept}
                        className="rounded-xl border-2 border-stone-300 bg-white p-3 text-center text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50"
                      >
                        <p className="text-lg">💬</p>
                        <p className="text-sm font-medium">{convLoading ? "启动中..." : "对话考察"}</p>
                        <p className="mt-0.5 text-[11px] text-stone-400">多轮追问 + 综合评价</p>
                      </button>
                    </div>
                  </div>

                  {/* 其他薄弱知识点可选列表 */}
                  {weakPoints.length > 1 && (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <h3 className="mb-3 text-sm font-semibold text-stone-700">其他薄弱知识点</h3>
                      <div className="flex flex-wrap gap-2">
                        {weakPoints.map((wp) => (
                          <button
                            key={wp.concept}
                            type="button"
                            onClick={() => switchConcept(wp.concept)}
                            className={`rounded-full border px-3 py-1 text-sm transition ${
                              wp.concept === concept
                                ? "border-[#C67A4A] bg-[#C67A4A]/10 text-[#C67A4A]"
                                : "border-stone-200 text-stone-600 hover:border-stone-400"
                            }`}
                          >
                            {wp.concept}
                            <span className="ml-1 text-xs text-stone-400">{Math.round(wp.confidence * 100)}%</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : finished ? (
                /* 测验完成总结 */
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-stone-800">测验完成</h2>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-stone-50 p-4 text-center">
                      <p className="text-2xl font-semibold text-stone-800">{questions.length}</p>
                      <p className="text-xs text-stone-500">总题数</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-4 text-center">
                      <p className="text-2xl font-semibold text-[#6b8e6b]">
                        {scores.filter((s) => s >= 3).length}
                      </p>
                      <p className="text-xs text-stone-500">答对</p>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-4 text-center">
                      <p className="text-2xl font-semibold text-stone-800">{avgScore}</p>
                      <p className="text-xs text-stone-500">平均分</p>
                    </div>
                  </div>
                  <p className="mb-4 text-sm text-stone-500">
                    掌握度已根据你的表现自动更新。
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetQuiz}
                      className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]"
                    >
                      再来一轮
                    </button>
                    <Link
                      href="/knowledge"
                      className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
                    >
                      返回知识图谱
                    </Link>
                  </div>
                </div>
              ) : ankiMode && questions.length > 0 ? (
                /* Anki 卡片模式 — 正面=问题，反面=参考答案 */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-stone-500">
                      Anki 卡片：{concept}（{ankiIndex + 1} / {questions.length}）
                    </p>
                    <button
                      type="button"
                      onClick={() => { setAnkiMode(false); setQuestions([]); setAnkiIndex(0); setAnkiFlipped(false); setAnkiScores([]); }}
                      className="rounded-lg border border-stone-200 px-3 py-1 text-sm text-stone-600 transition hover:bg-stone-100"
                    >
                      退出
                    </button>
                  </div>

                  {/* 卡片 — 正面只显示问题，反面显示答案+原题回顾 */}
                  <div
                    className="cursor-pointer rounded-2xl border border-stone-200 bg-white p-8 transition hover:shadow-md"
                    onClick={() => !ankiFlipped && setAnkiFlipped(true)}
                  >
                    {!ankiFlipped ? (
                      <div>
                        <p className="mb-3 text-center text-xs text-stone-400">想一想答案，然后点击翻转</p>
                        <div className="text-left">
                          <MarkdownRenderer content={splitQuestionAndAnswer(questions[ankiIndex] ?? "").question} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-3 text-center text-xs text-[#6b8e6b]">参考答案</p>
                        <div className="text-left">
                          <MarkdownRenderer content={splitQuestionAndAnswer(questions[ankiIndex] ?? "").answer} />
                        </div>
                        <hr className="my-4 border-stone-200" />
                        <p className="text-center text-xs text-stone-400">原题回顾</p>
                        <div className="mt-2 text-left opacity-70">
                          <MarkdownRenderer content={splitQuestionAndAnswer(questions[ankiIndex] ?? "").question} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FSRS 四按钮评分 — 翻转后才显示 */}
                  {ankiFlipped && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { rating: 1, label: "重来", desc: "完全不会", color: "bg-red-500 hover:bg-red-600" },
                        { rating: 2, label: "困难", desc: "勉强想起", color: "bg-orange-500 hover:bg-orange-600" },
                        { rating: 3, label: "良好", desc: "正常回忆", color: "bg-green-600 hover:bg-green-700" },
                        { rating: 4, label: "轻松", desc: "非常简单", color: "bg-blue-500 hover:bg-blue-600" },
                      ].map((btn) => (
                        <button
                          key={btn.rating}
                          type="button"
                          onClick={async () => {
                            // 调用 Anki 评分 API
                            try {
                              await fetch(`${API_URL}/api/quiz/anki-rate`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ concept, rating: btn.rating }),
                              });
                            } catch { /* 静默 */ }
                            setAnkiScores((prev) => [...prev, btn.rating]);
                            // 下一张卡
                            if (ankiIndex + 1 < questions.length) {
                              setAnkiIndex((i) => i + 1);
                              setAnkiFlipped(false);
                            } else {
                              setFinished(true);
                              setAnkiMode(false);
                            }
                          }}
                          className={`rounded-xl ${btn.color} p-3 text-white transition`}
                        >
                          <p className="text-sm font-medium">{btn.label}</p>
                          <p className="text-[11px] opacity-80">{btn.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 答题中 */
                <div className="space-y-6">
                  <p className="text-sm text-stone-500">测验主题：{concept}</p>
                  {/* 进度 */}
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <span>第 {currentIndex + 1} / {questions.length} 题</span>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-stone-200">
                        <div
                          className="h-1.5 rounded-full bg-[#C67A4A] transition-all"
                          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 当前题目 */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6">
                    <MarkdownRenderer content={questions[currentIndex] ?? ""} />
                  </div>

                  {/* 作答 / 结果 */}
                  {!result ? (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <h3 className="mb-3 text-sm font-semibold text-stone-700">你的回答</h3>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="写下你的答案..."
                        rows={4}
                        disabled={submitting}
                        className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400 disabled:bg-stone-50"
                      />
                      <button
                        type="button"
                        onClick={submitAnswer}
                        disabled={!answer.trim() || submitting}
                        className="mt-3 rounded-lg bg-stone-800 px-6 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-400"
                      >
                        {submitting ? "评分中，请稍候..." : "提交答案"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6">
                      <div className="mb-3 flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            result.is_correct
                              ? "bg-[#6b8e6b]/10 text-[#6b8e6b]"
                              : "bg-[#c07060]/10 text-[#c07060]"
                          }`}
                        >
                          {result.is_correct ? "回答正确" : "需要巩固"}
                        </span>
                        <span className="text-sm text-stone-500">得分：{result.score}/5</span>
                      </div>
                      {result.explanation && (
                        <div className="mb-4 rounded-xl bg-stone-50 p-4">
                          <p className="mb-1 text-xs font-medium text-stone-500">解析</p>
                          <p className="text-sm leading-relaxed text-stone-700">{result.explanation}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={nextQuestion}
                        className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]"
                      >
                        {currentIndex + 1 >= questions.length ? "查看总结" : "下一题"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
        </div>
      </div>
    </MainShell>
  );
}
