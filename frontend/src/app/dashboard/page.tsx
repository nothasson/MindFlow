"use client";

import { useEffect, useState } from "react";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface DashboardStats {
  total_conversations: number;
  total_messages: number;
  total_resources: number;
  total_courses: number;
  total_days: number;
  streak: number;
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
              <div
                key={s.label}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
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
            <p className="text-sm text-stone-400">
              暂无学习数据，开始对话后这里会显示你的薄弱知识点。
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">学习趋势</h2>
            <p className="text-sm text-stone-400">
              暂无学习数据，持续学习后这里会显示你的学习频率和进步曲线。
            </p>
          </div>
        </div>
      </div>
    </MainShell>
  );
}
