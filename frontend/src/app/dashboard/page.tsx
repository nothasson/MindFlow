"use client";

import { useEffect, useState } from "react";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface WeakPoint {
  concept: string;
  confidence: number;
}

interface TrendDay {
  date: string;
  count: number;
}

interface DashboardStats {
  total_conversations: number;
  total_messages: number;
  total_resources: number;
  total_courses: number;
  total_days: number;
  streak: number;
  weak_points: WeakPoint[];
  trend: TrendDay[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const cards = stats
    ? [
        { label: "学习天数", value: String(stats.total_days), unit: "天" },
        { label: "连续学习", value: String(stats.streak), unit: "天" },
        { label: "对话数", value: String(stats.total_conversations), unit: "次" },
        { label: "消息数", value: String(stats.total_messages), unit: "条" },
        { label: "资料数", value: String(stats.total_resources), unit: "份" },
        { label: "课程数", value: String(stats.total_courses), unit: "门" },
      ]
    : [
        { label: "学习天数", value: "—", unit: "" },
        { label: "连续学习", value: "—", unit: "" },
        { label: "对话数", value: "—", unit: "" },
        { label: "消息数", value: "—", unit: "" },
        { label: "资料数", value: "—", unit: "" },
        { label: "课程数", value: "—", unit: "" },
      ];

  const weakPoints = stats?.weak_points ?? [];
  const trend = stats?.trend ?? [];

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">学习仪表盘</h1>
          <p className="mb-8 text-sm text-stone-500">
            整体学习进度和数据分析。
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-stone-200 bg-white p-5">
                <p className="text-xs text-stone-400">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-800">
                  {s.value}
                  {s.unit ? <span className="ml-1 text-sm font-normal text-stone-400">{s.unit}</span> : null}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">薄弱点排行</h2>
            {weakPoints.length > 0 ? (
              <div className="space-y-2">
                {weakPoints.map((wp) => (
                  <a
                    key={wp.concept}
                    href={`/?q=${encodeURIComponent(wp.concept)}`}
                    className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3 transition hover:bg-stone-100"
                  >
                    <span className="text-sm text-stone-800">{wp.concept}</span>
                    <span className="text-xs text-stone-400">
                      掌握度 {Math.round(wp.confidence * 100)}%
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">
                暂无薄弱知识点，开始学习后这里会显示掌握度低于 50% 的概念。
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">学习趋势（近 7 天）</h2>
            {trend.length > 0 ? (
              <div className="flex items-end gap-2">
                {trend.map((day) => {
                  const maxCount = Math.max(...trend.map((d) => d.count), 1);
                  const height = Math.max(4, (day.count / maxCount) * 120);
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs text-stone-500">{day.count}</span>
                      <div
                        className="w-full rounded-t-md bg-[#C67A4A]/70"
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[10px] text-stone-400">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-stone-400">
                暂无学习数据，持续学习后这里会显示每日消息数趋势。
              </p>
            )}
          </div>
        </div>
      </div>
    </MainShell>
  );
}
