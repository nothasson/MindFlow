"use client";

import { MainShell } from "@/components/layout/MainShell";

const daysOfWeek = ["一", "二", "三", "四", "五", "六", "日"];

function generateCalendarDays(): { day: number; isToday: boolean; hasTasks: boolean }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      day: i,
      isToday: i === today,
      hasTasks: false, // 后续从 API 获取
    });
  }
  return days;
}

export default function ReviewPage() {
  const days = generateCalendarDays();
  const now = new Date();
  const monthName = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold text-stone-800">复习计划</h1>
        <p className="mb-8 text-sm text-stone-500">
          基于遗忘曲线自动安排复习，确保知识长期记忆。
        </p>

        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">{monthName}</h2>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {daysOfWeek.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-stone-400">
                {d}
              </div>
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
          <h2 className="mb-4 text-lg font-semibold text-stone-800">今日复习</h2>
          <p className="text-sm text-stone-400">暂无到期的复习项</p>
        </div>

        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">即将到期</h2>
          <p className="text-sm text-stone-400">暂无即将到期的复习项</p>
        </div>
        </div>
      </div>
    </MainShell>
  );
}
