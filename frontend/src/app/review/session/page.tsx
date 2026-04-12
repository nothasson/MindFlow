"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { getReviewDue, generateQuiz as apiGenerateQuiz, submitQuiz, type ReviewItem, type QuizSubmitResult } from "@/lib/api";

interface QuizQuestion {
  id: string;
  concept: string;
  question: string;
  answer: string;
  explanation: string;
}

interface SubmitResult {
  correct: boolean;
  score: number;
  explanation: string;
  correct_answer: string;
}

/** FSRS 评分按钮定义 */
const FSRS_RATINGS = [
  { label: "重来", value: 1, desc: "完全不会", color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { label: "困难", value: 2, desc: "勉强想起", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { label: "良好", value: 3, desc: "有些犹豫", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  { label: "轻松", value: 4, desc: "毫不费力", color: "bg-green-100 text-green-700 hover:bg-green-200" },
] as const;

/* ─── 阶段枚举 ─── */
type Phase = "loading" | "answering" | "submitted" | "rated" | "done";

/* ─── 主页面 ─── */

export default function ReviewSessionPage() {
  // 复习队列
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 当前题目
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // 逐题展示：拆分后的题目数组和当前题索引
  const [quizQuestions, setQuizQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // 统计
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);

  // 阶段控制
  const [phase, setPhase] = useState<Phase>("loading");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 加载到期复习项
  useEffect(() => {
    getReviewDue()
      .then((d) => {
        const list: ReviewItem[] = d.items ?? [];
        setItems(list);
        if (list.length === 0) {
          setPhase("done");
        }
      })
      .catch(() => {
        setItems([]);
        setPhase("done");
      });
  }, []);

  // 解析 LLM 返回的多题文本为单题数组
  const parseQuestions = (text: string): string[] => {
    const parts = text.split(/(?=###\s*题目|(?:^|\n)\*\*题目)/);
    const filtered = parts.filter((p) => p.trim().length > 20);
    return filtered.length > 0 ? filtered : [text];
  };

  // 为当前概念生成题目
  const generateQuiz = useCallback(
    async (concept: string) => {
      setGenerating(true);
      setQuiz(null);
      setAnswer("");
      setResult(null);
      setSelectedRating(null);
      setQuizQuestions([]);
      setCurrentQuestionIndex(0);
      try {
        const data = await apiGenerateQuiz({ concept });
        // API 返回 {concept, questions} — questions 是 Markdown 文本
        const questionText = typeof data.questions === "string" ? data.questions : `请解释「${concept}」的核心概念。`;
        // 拆分成单题数组
        const parsed = parseQuestions(questionText);
        setQuizQuestions(parsed);
        setCurrentQuestionIndex(0);
        // quiz 设为第一题
        setQuiz({
          id: `quiz-${Date.now()}`,
          concept: data.concept ?? concept,
          question: parsed[0],
          answer: "",
          explanation: "",
        });
        setPhase("answering");
      } catch {
        // 生成失败时显示一个简单的自评题
        const fallbackQuestions = [`请回忆并解释「${concept}」的核心内容。`];
        setQuizQuestions(fallbackQuestions);
        setCurrentQuestionIndex(0);
        setQuiz({
          id: "fallback",
          concept,
          question: fallbackQuestions[0],
          answer: "",
          explanation: "",
        });
        setPhase("answering");
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  // 当 items 和 currentIndex 变化时自动生成题目
  useEffect(() => {
    if (items.length > 0 && currentIndex < items.length && phase === "loading") {
      generateQuiz(items[currentIndex].concept);
    }
  }, [items, currentIndex, phase, generateQuiz]);

  // 提交答案
  const handleSubmit = async () => {
    if (!quiz || !answer.trim()) return;
    setSubmitting(true);
      try {
        const data = await submitQuiz({
          concept: quiz.concept,
          question: quiz.question.slice(0, 500), // 只发送当前单题
          answer: answer.trim(),
        });
        // 后端返回 {is_correct, score, explanation, concept}
        const submitResult: SubmitResult = {
          correct: data.is_correct ?? false,
          score: data.score ?? 0,
          explanation: data.explanation ?? "",
          correct_answer: "",
        };
      setResult(submitResult);
      if (submitResult.correct) {
        setCorrectCount((c) => c + 1);
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      setPhase("submitted");
    } catch {
      // 提交失败时允许自评
      setResult({
        correct: false,
        score: 0,
        explanation: "提交评分失败，请自行评估掌握程度。",
        correct_answer: quiz.answer || "（参考答案不可用）",
      });
      setPhase("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  // 选择 FSRS 评分
  const handleRate = (rating: number) => {
    setSelectedRating(rating);
    setPhase("rated");
  };

  // 下一题：先检查同概念下是否还有下一个子题，再切换到下一个概念
  const handleNext = () => {
    const nextQIdx = currentQuestionIndex + 1;
    if (nextQIdx < quizQuestions.length) {
      // 同概念下还有子题，切到下一题
      setCurrentQuestionIndex(nextQIdx);
      setQuiz((prev) =>
        prev ? { ...prev, question: quizQuestions[nextQIdx] } : prev
      );
      setAnswer("");
      setResult(null);
      setSelectedRating(null);
      setPhase("answering");
    } else {
      // 当前概念所有子题答完，切到下一个概念
      const nextIdx = currentIndex + 1;
      if (nextIdx >= items.length) {
        setPhase("done");
      } else {
        setCurrentIndex(nextIdx);
        setPhase("loading");
      }
    }
  };

  const total = items.length;
  const currentItem = items[currentIndex] ?? null;
  const progress = total > 0 ? ((currentIndex + (phase === "done" ? 0 : 0)) / total) * 100 : 0;
  const completedProgress = total > 0 ? (phase === "done" ? 100 : ((currentIndex) / total) * 100) : 0;

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-2xl overflow-y-auto px-4 py-12">

          {/* 完成总结 */}
          {phase === "done" ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
              <div className="mb-4 text-4xl">
                {correctCount === total && total > 0 ? "🎉" : "📝"}
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-stone-800">
                {total === 0 ? "暂无到期复习" : "复习完成！"}
              </h1>
              {total > 0 ? (
                <div className="mb-6 space-y-1 text-sm text-stone-500">
                  <p>共复习 {total} 个知识点</p>
                  <p>
                    答对 {correctCount} 题，正确率{" "}
                    {Math.round((correctCount / total) * 100)}%
                  </p>
                </div>
              ) : (
                <p className="mb-6 text-sm text-stone-500">
                  当前没有到期的复习项，稍后再来看看吧。
                </p>
              )}
              <div className="flex justify-center gap-3">
                <Link
                  href="/review"
                  className="rounded-xl border border-stone-200 px-6 py-2.5 text-sm text-stone-600 transition hover:bg-stone-50"
                >
                  返回复习计划
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-[#C67A4A] px-6 py-2.5 text-sm text-white transition hover:bg-[#B06A3A]"
                >
                  查看仪表盘
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* 进度条 */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-stone-500">
                    复习进度 {currentIndex + 1}/{total}
                    {quizQuestions.length > 1 && (
                      <span className="ml-2 text-xs text-stone-400">
                        （第 {currentQuestionIndex + 1}/{quizQuestions.length} 题）
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {streak > 0 && (
                      <span className="text-sm text-orange-600">
                        连胜 🔥 {streak}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-[#C67A4A] transition-all duration-300"
                    style={{ width: `${completedProgress}%` }}
                  />
                </div>
              </div>

              {/* 题目卡片 */}
              <div className="rounded-2xl border border-stone-200 bg-white">
                {/* 概念标题 */}
                <div className="border-b border-stone-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#C67A4A]/10 px-2.5 py-1 text-xs font-medium text-[#C67A4A]">
                      概念
                    </span>
                    <h2 className="text-lg font-semibold text-stone-800">
                      {currentItem?.concept ?? "加载中…"}
                    </h2>
                  </div>
                  {currentItem && (
                    <p className="mt-1 text-xs text-stone-400">
                      当前掌握度 {Math.round(currentItem.confidence * 100)}% · 间隔{" "}
                      {currentItem.interval_days} 天
                    </p>
                  )}
                </div>

                {/* 题目内容 */}
                <div className="px-6 py-5">
                  {generating ? (
                    <div className="flex items-center gap-2 py-8 text-sm text-stone-400">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="opacity-25"
                        />
                        <path
                          d="M4 12a8 8 0 018-8"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      正在生成题目…
                    </div>
                  ) : quiz ? (
                    <div className="text-stone-700">
                      <MarkdownRenderer content={quiz.question} />
                    </div>
                  ) : null}
                </div>

                {/* 答题区 */}
                {phase === "answering" && quiz && (
                  <div className="border-t border-stone-100 px-6 py-5">
                    <textarea
                      className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800 outline-none transition focus:border-[#C67A4A]/50 focus:ring-1 focus:ring-[#C67A4A]/20"
                      rows={4}
                      placeholder="输入你的回答…"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSubmit();
                        }
                      }}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">
                        Ctrl+Enter 提交
                      </span>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!answer.trim() || submitting}
                        className="rounded-xl bg-[#C67A4A] px-6 py-2 text-sm text-white transition hover:bg-[#B06A3A] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting ? "评分中…" : "提交答案"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 评分结果 */}
                {(phase === "submitted" || phase === "rated") && result && (
                  <div className="border-t border-stone-100 px-6 py-5">
                    {/* 对错提示 */}
                    <div
                      className={`mb-4 rounded-xl p-4 ${
                        result.correct
                          ? "border border-green-200 bg-green-50"
                          : "border border-red-200 bg-red-50"
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          result.correct ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {result.correct ? "答对了！" : "答错了"}
                        {result.score > 0 && (
                          <span className="ml-2 text-stone-400">
                            得分：{Math.round(result.score * 100)}%
                          </span>
                        )}
                      </p>
                      {result.explanation && (
                        <p className="mt-2 text-sm text-stone-600">
                          💡 {result.explanation}
                        </p>
                      )}
                      {!result.correct && result.correct_answer && (
                        <p className="mt-2 text-sm text-stone-600">
                          📝 参考答案：{result.correct_answer}
                        </p>
                      )}
                    </div>

                    {/* FSRS 评分按钮 */}
                    {phase === "submitted" && (
                      <div>
                        <p className="mb-3 text-sm text-stone-500">
                          请评估你对这个知识点的掌握程度：
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {FSRS_RATINGS.map((rating) => (
                            <button
                              key={rating.value}
                              type="button"
                              onClick={() => handleRate(rating.value)}
                              className={`flex flex-col items-center rounded-xl p-3 text-center transition ${rating.color}`}
                            >
                              <span className="text-sm font-medium">
                                {rating.label}
                              </span>
                              <span className="mt-0.5 text-[10px] opacity-70">
                                {rating.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 已评分，显示下一题按钮 */}
                    {phase === "rated" && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-stone-400">
                          已评分：
                          {FSRS_RATINGS.find((r) => r.value === selectedRating)?.label}
                        </p>
                        <button
                          type="button"
                          onClick={handleNext}
                          className="rounded-xl bg-[#C67A4A] px-6 py-2 text-sm text-white transition hover:bg-[#B06A3A]"
                        >
                          {currentQuestionIndex + 1 < quizQuestions.length
                            ? "下一题 →"
                            : currentIndex + 1 >= total
                              ? "查看总结"
                              : "下一个概念 →"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MainShell>
  );
}
