"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { getDashboardStats, getDashboardHeatmap, getMasteryDistribution } from "@/lib/api";
import type { DashboardStats, HeatmapEntry, MasteryDistribution, WeakPoint } from "@/lib/api";

// ========== 热力图组件 ==========

/** 获取热力图颜色等级 */
function heatmapColor(count: number, max: number): string {
  if (count === 0) return "bg-stone-100";
  const ratio = count / Math.max(max, 1);
  if (ratio >= 0.75) return "bg-[#C67A4A]";
  if (ratio >= 0.5) return "bg-[#C67A4A]/70";
  if (ratio >= 0.25) return "bg-[#C67A4A]/40";
  return "bg-[#C67A4A]/20";
}

function HeatmapChart({ data }: { data: HeatmapEntry[] }) {
  // 构建日期 → count 映射
  const countMap: Record<string, number> = {};
  let maxCount = 1;
  for (const entry of data) {
    countMap[entry.date] = entry.count;
    if (entry.count > maxCount) maxCount = entry.count;
  }

  // 生成最近 365 天的日期列表
  const today = new Date();
  const days: string[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // 按列组织（每列=一周，7天），从周日开始
  // 找出第一天是星期几，前面填空
  const firstDate = new Date(days[0]);
  const startDow = firstDate.getDay(); // 0=周日
  const paddedDays: (string | null)[] = Array.from(
    { length: startDow },
    () => null
  );
  paddedDays.push(...days);

  // 分成每列 7 行
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  // 月份标签
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = "";
  for (let w = 0; w < weeks.length; w++) {
    const weekDays = weeks[w].filter(Boolean) as string[];
    if (weekDays.length > 0) {
      const month = weekDays[0].slice(0, 7); // "YYYY-MM"
      if (month !== lastMonth) {
        const m = new Date(weekDays[0]).toLocaleString("zh-CN", {
          month: "short",
        });
        monthLabels.push({ label: m, col: w });
        lastMonth = month;
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      {/* 月份标签行 */}
      <div className="mb-1 flex" style={{ paddingLeft: "20px" }}>
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="text-[10px] text-stone-400"
            style={{
              position: "relative",
              left: `${m.col * 14}px`,
              marginRight: i < monthLabels.length - 1 ? undefined : undefined,
            }}
          >
            {m.label}
          </span>
        ))}
      </div>
      {/* 热力图网格 */}
      <div className="flex gap-[2px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const day = week[di] ?? null;
              const count = day ? countMap[day] ?? 0 : 0;
              return (
                <div
                  key={di}
                  className={`h-[12px] w-[12px] rounded-sm ${day ? heatmapColor(count, maxCount) : "bg-transparent"}`}
                  title={day ? `${day}: ${count} 条消息` : ""}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* 图例 */}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-stone-400">
        <span>少</span>
        <div className="h-[10px] w-[10px] rounded-sm bg-stone-100" />
        <div className="h-[10px] w-[10px] rounded-sm bg-[#C67A4A]/20" />
        <div className="h-[10px] w-[10px] rounded-sm bg-[#C67A4A]/40" />
        <div className="h-[10px] w-[10px] rounded-sm bg-[#C67A4A]/70" />
        <div className="h-[10px] w-[10px] rounded-sm bg-[#C67A4A]" />
        <span>多</span>
      </div>
    </div>
  );
}

// ========== 掌握度环形图组件 ==========

function MasteryDonut({ data }: { data: MasteryDistribution }) {
  const { mastered, learning, weak, total } = data;
  if (total === 0) {
    return (
      <p className="text-sm text-stone-400">
        暂无知识点数据，上传学习资料后这里会显示掌握度分布。
      </p>
    );
  }

  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const center = radius + strokeWidth / 2;
  const size = center * 2;

  // 计算各段弧长
  const masteredLen = (mastered / total) * circumference;
  const learningLen = (learning / total) * circumference;
  const weakLen = (weak / total) * circumference;

  // 各段偏移
  const masteredOffset = 0;
  const learningOffset = circumference - masteredLen;
  const weakOffset = circumference - masteredLen - learningLen;

  const segments = [
    {
      label: "已掌握",
      count: mastered,
      color: "#4ade80",
      len: masteredLen,
      offset: masteredOffset,
    },
    {
      label: "学习中",
      count: learning,
      color: "#facc15",
      len: learningLen,
      offset: learningOffset,
    },
    {
      label: "薄弱",
      count: weak,
      color: "#f87171",
      len: weakLen,
      offset: weakOffset,
    },
  ];

  // strokeDashoffset 计算：每段需要偏移前面所有段的长度
  let accumulated = 0;

  return (
    <div className="flex items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        {segments.map((seg, i) => {
          const dashOffset = circumference - accumulated;
          accumulated += seg.len;
          if (seg.count === 0) return null;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.len} ${circumference - seg.len}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
        })}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-stone-800 text-lg font-semibold"
          fontSize="18"
        >
          {total}
        </text>
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-stone-400"
          fontSize="10"
        >
          知识点
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-sm text-stone-600">
              {seg.label}
              <span className="ml-1 font-medium text-stone-800">
                {seg.count}
              </span>
              <span className="ml-1 text-stone-400">
                ({total > 0 ? Math.round((seg.count / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 从热力图数据计算连续学习天数 */
function calcStreakFromHeatmap(entries: HeatmapEntry[]): number {
  const set = new Set(entries.filter((e) => e.count > 0).map((e) => e.date));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// ========== 主页面 ==========

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [mastery, setMastery] = useState<MasteryDistribution | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then((d) => setStats(d))
      .catch(() => {});

    getDashboardHeatmap()
      .then((d) => setHeatmap(d.heatmap ?? []))
      .catch(() => {});

    getMasteryDistribution()
      .then((d) => setMastery(d))
      .catch(() => {});
  }, []);

  // 从热力图数据计算连续学习天数（作为后备）
  const streakFromHeatmap = useMemo(() => calcStreakFromHeatmap(heatmap), [heatmap]);
  const streakDays = stats?.streak ?? streakFromHeatmap;

  const cards = stats
    ? [
        { label: "学习天数", value: String(stats.total_days), unit: "天" },
        { label: "连续学习", value: String(stats.streak), unit: "天" },
        {
          label: "对话数",
          value: String(stats.total_conversations),
          unit: "次",
        },
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

  const weakPoints = (stats?.weak_points ?? []).slice(0, 5);
  const trend = stats?.trend ?? [];

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-12">
          {/* 标题 + 连续学习徽章 */}
          <div className="mb-2 flex items-start justify-between">
            <h1 className="text-2xl font-semibold text-stone-800">学习数据</h1>
            {streakDays > 0 && (
              <div className="flex shrink-0 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2">
                <span className="text-xl" role="img" aria-label="连续学习">
                  {streakDays >= 30 ? "💎" : streakDays >= 7 ? "🔥" : "✨"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-orange-700">
                    连续 {streakDays} 天
                  </p>
                  <p className="text-[10px] text-orange-400">
                    {streakDays >= 30
                      ? "持之以恒！"
                      : streakDays >= 7
                        ? "保持学习势头！"
                        : "继续加油！"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* tab 导航：与 quiz 页风格一致 */}
          <div className="mb-6 flex gap-4 border-b border-stone-200">
            <span className="border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]">数据总览</span>
            <Link href="/review" className="pb-2 text-sm text-stone-400 transition hover:text-stone-600">复习计划</Link>
            <Link href="/memory" className="pb-2 text-sm text-stone-400 transition hover:text-stone-600">学习历程</Link>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cards.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
                <p className="text-xs text-stone-400">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-800">
                  {s.value}
                  {s.unit ? (
                    <span className="ml-1 text-sm font-normal text-stone-400">
                      {s.unit}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          {/* 热力图 */}
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              学习活跃度
            </h2>
            <HeatmapChart data={heatmap} />
          </div>

          {/* 掌握度分布 + 薄弱 Top 5 并排 */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 掌握度环形图 */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-stone-800">
                掌握度分布
              </h2>
              {mastery ? (
                <MasteryDonut data={mastery} />
              ) : (
                <p className="text-sm text-stone-400">加载中…</p>
              )}
            </div>

            {/* 薄弱 Top 5 */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-stone-800">
                薄弱 Top 5
              </h2>
              {weakPoints.length > 0 ? (
                <div className="space-y-2">
                  {weakPoints.map((wp) => (
                    <div
                      key={wp.concept}
                      className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-stone-800">
                          {wp.concept}
                        </span>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-stone-200">
                          <div
                            className="h-1.5 rounded-full bg-red-400"
                            style={{
                              width: `${Math.round(wp.confidence * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-3 flex shrink-0 gap-1">
                        <Link
                          href="/review"
                          className="rounded-lg bg-[#C67A4A]/10 px-2 py-1 text-[10px] text-[#C67A4A] transition hover:bg-[#C67A4A]/20"
                          title="开始复习"
                        >
                          复习
                        </Link>
                        <Link
                          href={`/quiz?concept=${encodeURIComponent(wp.concept)}`}
                          className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] text-blue-600 transition hover:bg-blue-100"
                          title="生成练习题"
                        >
                          出题
                        </Link>
                        <Link
                          href="/wrongbook"
                          className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] text-stone-500 transition hover:bg-stone-200"
                          title="查看错题"
                        >
                          错题
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400">
                  暂无薄弱知识点，开始学习后这里会显示掌握度最低的 5
                  个概念。
                </p>
              )}
            </div>
          </div>

          {/* 学习趋势 */}
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              学习趋势（近 7 天）
            </h2>
            {trend.length > 0 ? (
              <div className="flex items-end gap-2">
                {trend.map((day) => {
                  const maxCount = Math.max(
                    ...trend.map((d) => d.count),
                    1
                  );
                  const height = Math.max(
                    4,
                    (day.count / maxCount) * 120
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <span className="text-xs text-stone-500">
                        {day.count}
                      </span>
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
