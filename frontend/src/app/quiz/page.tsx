"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const concept = searchParams?.get("concept") ?? "";

  const [questions, setQuestions] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ is_correct: boolean; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "出题失败");
    } finally {
      setLoading(false);
    }
  }, [concept]);

  const submitAnswer = useCallback(async () => {
    if (!answer.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, question: questions.slice(0, 200), answer }),
      });
      if (!res.ok) throw new Error("提交失败");
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }, [concept, questions, answer]);

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
          ) : !questions ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
              <p className="mb-4 text-stone-500">准备好了吗？AI 将根据「{concept}」生成测验题</p>
              <button
                type="button"
                onClick={generateQuiz}
                disabled={loading}
                className="rounded-lg bg-[#C67A4A] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a] disabled:bg-stone-400"
              >
                {loading ? "出题中..." : "开始测验"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 题目展示 */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <h2 className="mb-4 text-base font-semibold text-stone-800">题目</h2>
                <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                  {questions}
                </div>
              </div>

              {/* 作答区 */}
              {!submitted ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <h2 className="mb-3 text-base font-semibold text-stone-800">你的回答</h2>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="写下你的答案..."
                    rows={6}
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
              ) : result ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <h2 className="mb-3 text-base font-semibold text-stone-800">评分结果</h2>
                  <p className="text-sm text-stone-700">
                    得分：{result.score}/5 · {result.is_correct ? "回答正确" : "需要继续巩固"}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    掌握度已更新。
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setQuestions(""); setAnswer(""); setSubmitted(false); setResult(null); }}
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
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </MainShell>
  );
}
