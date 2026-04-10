"use client";

import { useCallback, useEffect, useState } from "react";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface TimelineEntry {
  date: string;
  log: string;
  learning: string;
}

interface SearchResult {
  source: string;
  content: string;
}

export default function MemoryPage() {
  const [profile, setProfile] = useState("");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/memory/profile`)
      .then((r) => r.json())
      .then((d) => setProfile(d.profile || ""))
      .catch(() => {});

    fetch(`${API_URL}/api/memory/timeline`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.entries || []))
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

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">学习记忆</h1>
          <p className="mb-8 text-sm text-stone-500">
            你的学习画像、每日记录和薄弱点追踪。
          </p>

          {/* 学习画像 */}
          <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">学习画像</h2>
            {profile ? (
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-stone-700">
                {profile}
              </pre>
            ) : (
              <p className="text-sm text-stone-400">
                暂无学习画像。持续学习后，系统会自动生成你的学习档案。
              </p>
            )}
          </div>

          {/* 搜索 */}
          <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-stone-800">搜索记忆</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索历史学习记录..."
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

          {/* 学习时间线 */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">学习时间线</h2>
            {timeline.length > 0 ? (
              <div className="space-y-6">
                {timeline.map((entry) => (
                  <div key={entry.date} className="border-l-2 border-stone-200 pl-4">
                    <p className="mb-2 text-sm font-semibold text-stone-700">{entry.date}</p>

                    {entry.log ? (
                      <div className="mb-2">
                        <p className="mb-1 text-xs text-stone-400">学习日志</p>
                        <p className="text-sm text-stone-600 whitespace-pre-wrap">
                          {entry.log.length > 500 ? entry.log.slice(0, 500) + "..." : entry.log}
                        </p>
                      </div>
                    ) : null}

                    {entry.learning ? (
                      <div>
                        <p className="mb-1 text-xs text-[#C67A4A]">精华总结</p>
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">
                          {entry.learning.length > 500 ? entry.learning.slice(0, 500) + "..." : entry.learning}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">
                暂无学习记录。开始对话学习后，每日记录会出现在这里。
              </p>
            )}
          </div>
        </div>
      </div>
    </MainShell>
  );
}
