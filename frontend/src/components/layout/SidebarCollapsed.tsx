interface SidebarCollapsedProps {
  onExpand: () => void;
}

const icons = [
  { label: "侧栏", d: "M3 3h7v7H3zM13 3h7v7h-7zM3 13h7v7H3zM13 13h7v7h-7z" },
  { label: "新建", d: "M12 5v14M5 12h14" },
  { label: "搜索", d: "M21 21l-5.2-5.2M11 19a8 8 0 100-16 8 8 0 000 16z" },
];

export function SidebarCollapsed({ onExpand }: SidebarCollapsedProps) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center bg-[#EEECE2] py-3">
      <button
        type="button"
        onClick={onExpand}
        aria-label="切换侧栏"
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-300/40 hover:text-stone-700"
      >
        <svg data-testid="sidebar-toggle-open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      </button>

      {icons.map((icon) => (
        <button
          key={icon.label}
          type="button"
          aria-label={icon.label}
          className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-300/40 hover:text-stone-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon.d} />
          </svg>
        </button>
      ))}

      <div className="mt-auto">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-400 text-[11px] font-semibold text-white">
          U
        </div>
      </div>
    </div>
  );
}
