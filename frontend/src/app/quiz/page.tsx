"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const concept = searchParams?.get("concept") ?? "";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ score: number; is_correct: boolean } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  // 解析 LLM 返回的多题文本为单题数组
  const parseQuestions = (text: string): string[] => {
    // 按 "### 题目" 或 "**题目" 分割
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
    if (!answer.trim()) return;
    setError(null);
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
    }
  }, [concept, questions, currentIndex, answer]);

  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setResult(null);
    }
  };

  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0";

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">知识测验</h1>
          <p className="mb-8 text-sm text-stone-500">
            {concept ? `测验主题：${concept}` : "请从知识图谱选择一个概念开始测验"}
          </p>

          {!concept ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
              <p className="mb-4 text-stone-500">请先从知识图谱选择一个概念</p>
              <Link
                href="/knowledge"
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
              >
                前往知识图谱
              </Link>
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
              <p className="mb-4 text-stone-500">准备好了吗？AI 将根据「{concept}」逐题出题</p>
              <button
                type="button"
                onClick={generateQuiz}
                disabled={loading}
                className="rounded-lg bg-[#C67A4A] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a] disabled:bg-stone-400"
              >
                {loading ? "出题中..." : "开始测验"}
              </button>
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
                掌握度已根据你的表现更新（SM-2 遗忘曲线）。
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setQuestions([]);
                    setScores([]);
                    setAnswer("");
                    setResult(null);
                    setFinished(false);
                  }}
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
          ) : (
            /* 答题中 */
            <div className="space-y-6">
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

              {/* 当前题目（Markdown 渲染） */}
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
                    className="w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
                  />
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!answer.trim()}
                    className="mt-3 rounded-lg bg-stone-800 px-6 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:bg-stone-400"
                  >
                    提交答案
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

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
        </div>
      </div>
    </MainShell>
  );
}
