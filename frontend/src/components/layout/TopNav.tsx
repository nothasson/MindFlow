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
          disabled={!item.active}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            item.active
              ? "border-blue-900 bg-blue-900 text-white"
              : "border-slate-200 bg-white text-slate-400"
          } ${!item.active ? "cursor-not-allowed" : "hover:bg-blue-800"}`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
