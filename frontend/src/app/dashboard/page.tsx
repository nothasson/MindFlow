"use client";

const stats = [
  { label: "总学习天数", value: "0", unit: "天" },
  { label: "已掌握概念", value: "0", unit: "个" },
  { label: "待复习", value: "0", unit: "项" },
  { label: "平均掌握度", value: "0", unit: "%" },
];

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col bg-[#EEECE2]">
      <div className="mx-auto w-full max-w-4xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold text-stone-800">学习仪表盘</h1>
        <p className="mb-8 text-sm text-stone-500">
          整体学习进度和数据分析。
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-stone-200 bg-white p-5"
            >
              <p className="text-xs text-stone-400">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-stone-800">
                {s.value}
                <span className="ml-1 text-sm font-normal text-stone-400">{s.unit}</span>
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

        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-stone-800">错误类型分布</h2>
          <p className="text-sm text-stone-400">
            暂无诊断数据，AI 诊断你的回答后这里会显示错误类型统计。
          </p>
        </div>
      </div>
    </div>
  );
}
