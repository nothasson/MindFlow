const navItems = [
  { label: "对话", active: true },
  { label: "知识图谱", active: false },
  { label: "复习计划", active: false },
  { label: "学习进度", active: false },
];

export function TopNav() {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2">
      {navItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`rounded-full border px-4 py-2 text-sm transition ${
            item.active
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          {item.label}
          {!item.active ? <span className="ml-2 text-xs">即将上线</span> : null}
        </button>
      ))}
    </nav>
  );
}
