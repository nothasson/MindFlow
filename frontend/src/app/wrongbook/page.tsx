"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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

export default function WrongBookPage() {
  const [entries, setEntries] = useState<WrongBookEntry[]>([]);
  const [stats, setStats] = useState<WrongBookStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/wrongbook`),
        fetch(`${API_URL}/api/wrongbook/stats`),
      ]);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.entries ?? []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats ?? []);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markReviewed = async (id: string) => {
    await fetch(`${API_URL}/api/wrongbook/${id}/review`, { method: "POST" });
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    await fetch(`${API_URL}/api/wrongbook/${id}`, { method: "DELETE" });
    fetchData();
  };

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => e.error_type === filter);

  const totalUnreviewed = entries.filter((e) => !e.reviewed).length;

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800">错题本</h1>
              <p className="text-sm text-stone-500">
                {totalUnreviewed > 0 ? `${totalUnreviewed} 道待复习` : "暂无待复习错题"}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-stone-400">加载中...</p>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
              <p className="mb-2 text-stone-500">还没有错题记录</p>
              <p className="mb-4 text-sm text-stone-400">完成测验后，答错的题目会自动收集到这里</p>
              <Link
                href="/quiz"
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
              >
                去做测验
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 错误类型统计 */}
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      filter === "all"
                        ? "border-[#C67A4A] bg-[#C67A4A]/10 text-[#C67A4A]"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    全部 ({entries.length})
                  </button>
                  {stats.map((s) => (
                    <button
                      key={s.error_type}
                      type="button"
                      onClick={() => setFilter(s.error_type)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        filter === s.error_type
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
              {filtered.map((entry) => (
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
                        onClick={() => toggleExpand(entry.id)}
                        className="mb-2 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                      >
                        <svg
                          className={`h-3 w-3 transition-transform ${expandedIds.has(entry.id) ? "rotate-90" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {expandedIds.has(entry.id) ? "收起详情" : "查看原题"}
                      </button>
                      {expandedIds.has(entry.id) && (
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
                    <Link
                      href={`/quiz?concept=${encodeURIComponent(entry.concept)}`}
                      className="rounded-lg bg-[#C67A4A] px-3 py-1.5 text-xs text-white transition hover:bg-[#b06a3a]"
                    >
                      练习巩固
                    </Link>
                    {!entry.reviewed && (
                      <button
                        type="button"
                        onClick={() => markReviewed(entry.id)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition hover:bg-stone-100"
                      >
                        标记已复习
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.id)}
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
      </div>
    </MainShell>
  );
}
