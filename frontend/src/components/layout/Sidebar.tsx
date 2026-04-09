const conversations = [
  { label: "线性代数基础", active: true },
  { label: "概率论复习", active: false },
  { label: "Python 数据结构", active: false },
];

const quickActions = [
  { label: "开始新对话", icon: "+" },
];

export function Sidebar() {
  return (
    <div className="flex h-full flex-col px-3 py-4 text-stone-300">
      <div className="mb-6 flex items-center justify-between px-2">
        <h1 className="text-base font-semibold text-white">MindFlow</h1>
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/10 hover:text-white"
          >
            {action.icon}
          </button>
        ))}
      </div>

      <div className="mb-4 px-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
          最近对话
        </p>
        <div className="space-y-0.5">
          {conversations.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                item.active
                  ? "bg-white/10 text-white"
                  : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-white/10 px-2 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-600 text-xs font-medium text-white">
            U
          </div>
          <div className="text-sm text-stone-300">学习者</div>
        </div>
      </div>
    </div>
  );
}
