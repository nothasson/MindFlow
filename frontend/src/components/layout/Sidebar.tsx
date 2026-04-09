const primaryActions = [
  "New chat",
  "Search",
  "Customize",
  "Chats",
  "Projects",
  "Artifacts",
  "Code",
];

const recents = [
  "线性代数基础",
  "概率论复习",
  "Python 数据结构",
  "遗忘曲线复盘",
];

export function Sidebar() {
  return (
    <div className="flex h-full flex-col px-3 py-4 text-stone-300">
      <div className="mb-5 px-3 text-[2rem] leading-none text-white">Claude</div>

      <div className="space-y-1 px-1">
        {primaryActions.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
              index === 0
                ? "bg-white/8 text-white"
                : "text-stone-300 hover:bg-white/6 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6 px-3">
        <p className="mb-2 text-xs text-stone-500">Recents</p>
        <div className="space-y-1">
          {recents.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                index === 0
                  ? "bg-white/10 text-white"
                  : "text-stone-400 hover:bg-white/6 hover:text-stone-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-white/10 px-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-600 text-xs font-medium text-white">
            H
          </div>
          <div>
            <div className="text-sm text-white">hasson</div>
            <div className="text-xs text-stone-500">Pro plan</div>
          </div>
        </div>
      </div>
    </div>
  );
}
