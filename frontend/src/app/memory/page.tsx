"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface ConvSummary {
  id: string;
  title: string;
  last_message: string;
  message_count: number;
  updated_at: string;
}

interface RecentConcept {
  concept: string;
  confidence: number;
}

interface KnowledgeStats {
  total: number;
  new: number;
  learning: number;
  mastered: number;
  recent: RecentConcept[];
}

interface CalendarDay {
  date: string;
  count: number;
}

export default function MemoryPage() {
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeStats | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ source: string; content: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/conversations/recent`)
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .catch(() => {});

    fetch(`${API_URL}/api/knowledge/recent`)
      .then((r) => r.json())
      .then((d) => setKnowledge(d))
      .catch(() => {});

    fetch(`${API_URL}/api/stats/calendar`)
      .then((r) => r.json())
      .then((d) => setCalendar(d.days || []))
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/memory/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // 生成本月日历
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const calendarMap: Record<string, number> = {};
  for (const d of calendar) {
    calendarMap[d.date] = d.count;
  }

  function heatColor(count: number): string {
    if (count === 0) return "bg-stone-100";
    if (count <= 5) return "bg-[#C67A4A]/20";
    if (count <= 15) return "bg-[#C67A4A]/50";
    return "bg-[#C67A4A]/80";
  }

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-12">
          <h1 className="mb-1 text-2xl font-semibold text-stone-800">学习数据</h1>
          <div className="mb-6 flex gap-4 border-b border-stone-200">
            <Link href="/dashboard" className="pb-2 text-sm text-stone-400 transition hover:text-stone-600">数据总览</Link>
            <Link href="/review" className="pb-2 text-sm text-stone-400 transition hover:text-stone-600">复习计划</Link>
            <span className="border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]">学习历程</span>
          </div>

          {/* 知识掌握进展 */}
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">知识掌握进展</h2>
            {knowledge && knowledge.total > 0 ? (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#c07060]/10 p-4 text-center">
                    <p className="text-2xl font-semibold text-[#c07060]">{knowledge.new}</p>
                    <p className="text-xs text-stone-500">新学习</p>
                  </div>
                  <div className="rounded-xl bg-[#c4a54a]/10 p-4 text-center">
                    <p className="text-2xl font-semibold text-[#c4a54a]">{knowledge.learning}</p>
                    <p className="text-xs text-stone-500">巩固中</p>
                  </div>
                  <div className="rounded-xl bg-[#6b8e6b]/10 p-4 text-center">
                    <p className="text-2xl font-semibold text-[#6b8e6b]">{knowledge.mastered}</p>
                    <p className="text-xs text-stone-500">已掌握</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {knowledge.recent.map((c) => (
                    <Link
                      key={c.concept}
                      href={`/?q=${encodeURIComponent(c.concept)}`}
                      className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3 transition hover:bg-stone-100"
                    >
                      <span className="text-sm text-stone-800">{c.concept}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-stone-200">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.round(c.confidence * 100)}%`,
                              backgroundColor: c.confidence >= 0.7 ? "#6b8e6b" : c.confidence >= 0.3 ? "#c4a54a" : "#c07060",
                            }}
                          />
                        </div>
                        <span className="text-xs text-stone-400">{Math.round(c.confidence * 100)}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-400">暂无知识点数据，上传资料后这里会显示你的学习进展。</p>
            )}
          </div>

          {/* 最近对话 */}
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">最近对话</h2>
            {conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/?conversation=${conv.id}`}
                    className="block rounded-xl border border-stone-100 bg-stone-50 p-4 transition hover:bg-stone-100"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-stone-800">{conv.title || "未命名对话"}</p>
                      <span className="text-xs text-stone-400">{conv.updated_at}</span>
                    </div>
                    {conv.last_message ? (
                      <p className="mt-1 text-sm text-stone-500 line-clamp-1">{conv.last_message}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-stone-400">{conv.message_count} 条消息</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">暂无对话记录，开始你的第一次学习吧。</p>
            )}
          </div>

          {/* 学习日历 */}
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              学习日历 · {now.getFullYear()} 年 {now.getMonth() + 1} 月
            </h2>
            <div className="grid grid-cols-7 gap-1">
              {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                <div key={d} className="py-1 text-center text-xs text-stone-400">{d}</div>
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const count = calendarMap[dateStr] || 0;
                const isToday = day === now.getDate();
                return (
                  <div
                    key={day}
                    className={`rounded-md py-2 text-center text-xs transition ${heatColor(count)} ${
                      isToday ? "ring-1 ring-[#C67A4A] font-semibold text-stone-800" : "text-stone-600"
                    }`}
                    title={`${dateStr}: ${count} 条消息`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 搜索记忆 */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">搜索学习记录</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索对话历史中的内容..."
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:bg-stone-400"
              >
                {searching ? "搜索中..." : "搜索"}
              </button>
            </div>
            {searchResults.length > 0 ? (
              <div className="mt-4 space-y-3">
                {searchResults.map((r, i) => (
                  <div key={i} className="rounded-xl bg-stone-50 p-4">
                    <p className="mb-1 text-xs text-stone-400">{r.source}</p>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </MainShell>
  );
}
