const statusItems = [
  { label: "掌握度", value: "67%" },
  { label: "待复习", value: "3" },
  { label: "连续学习", value: "5 天" },
];

const quickActions = ["继续上次会话", "开始一个新问题", "查看今日复习队列"];

export function Sidebar() {
  return (
    <div className="sticky top-6 space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">今日任务</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>· 完成 1 次概念澄清对话</li>
          <li>· 处理 3 个待复习知识点</li>
          <li>· 记录 1 条学习笔记</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">学习状态</h3>
        <div className="mt-3 space-y-2">
          {statusItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-medium text-slate-800">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">快捷操作</h3>
        <div className="mt-3 flex flex-col gap-2">
          {quickActions.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              {item}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
