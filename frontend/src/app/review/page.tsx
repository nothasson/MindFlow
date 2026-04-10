"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface ReviewItem {
  id: string;
  concept: string;
  confidence: number;
  interval_days: number;
  next_review: string;
}

const daysOfWeek = ["一", "二", "三", "四", "五", "六", "日"];

function generateCalendarDays(): { day: number; isToday: boolean }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isToday: i === today });
  }
  return days;
}

export default function ReviewPage() {
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);
  const [upcomingItems, setUpcomingItems] = useState<ReviewItem[]>([]);

  const days = generateCalendarDays();
  const now = new Date();
  const monthName = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;

  useEffect(() => {
    fetch(`${API_URL}/api/review/due`)
      .then((r) => r.json())
      .then((d) => setDueItems(d.items || []))
      .catch(() => {});

    fetch(`${API_URL}/api/review/upcoming`)
      .then((r) => r.json())
      .then((d) => setUpcomingItems(d.items || []))
      .catch(() => {});
  }, []);

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">复习计划</h1>
          <p className="mb-8 text-sm text-stone-500">
            基于遗忘曲线自动安排复习，确保知识长期记忆。
          </p>

          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">{monthName}</h2>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {daysOfWeek.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-stone-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  className={`rounded-lg py-3 text-center text-sm transition ${
                    d.isToday
                      ? "bg-[#C67A4A] font-semibold text-white"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {d.day}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              今日复习 {dueItems.length > 0 ? `(${dueItems.length})` : ""}
            </h2>
            {dueItems.length > 0 ? (
              <div>
                {/* 开始复习按钮 */}
                <Link
                  href="/review/session"
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C67A4A] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#B06A3A]"
                >
                  开始复习（{dueItems.length} 个知识点）
                  <span aria-hidden="true">→</span>
                </Link>
                <div className="space-y-2">
                  {dueItems.map((item) => (
                    <a
                      key={item.id}
                      href={`/?q=${encodeURIComponent("复习一下" + item.concept)}`}
                      className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-4 transition hover:bg-stone-100"
                    >
                      <div>
                        <p className="font-medium text-stone-800">{item.concept}</p>
                        <p className="text-xs text-stone-400">
                          掌握度 {Math.round(item.confidence * 100)}% · 间隔 {item.interval_days} 天
                        </p>
                      </div>
                      <span className="text-sm text-[#C67A4A]">单独复习 →</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-400">暂无到期的复习项</p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              即将到期 {upcomingItems.length > 0 ? `(${upcomingItems.length})` : ""}
            </h2>
            {upcomingItems.length > 0 ? (
              <div className="space-y-2">
                {upcomingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-4"
                  >
                    <div>
                      <p className="font-medium text-stone-800">{item.concept}</p>
                      <p className="text-xs text-stone-400">
                        掌握度 {Math.round(item.confidence * 100)}% · {new Date(item.next_review).toLocaleDateString("zh-CN")} 到期
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400">未来 7 天内暂无到期的复习项</p>
            )}
          </div>
        </div>
      </div>
    </MainShell>
  );
}
