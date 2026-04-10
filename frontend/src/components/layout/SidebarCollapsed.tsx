import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarCollapsedProps {
  onExpand: () => void;
  onNewChat?: () => void;
}

const tools = [
  { href: "/resources", label: "资料库", d: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" },
  { href: "/knowledge", label: "知识图谱", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/quiz", label: "知识测验", d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/wrongbook", label: "错题本", d: "M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97L13.75 4a2 2 0 00-3.5 0L3.32 16.03A2 2 0 005.07 19z" },
  { href: "/memory", label: "学习历程", d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/dashboard", label: "学习仪表盘", d: "M3 3v18h18M9 17V9m4 8V5m4 12v-4" },
  { href: "/review", label: "复习计划", d: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { href: "/settings", label: "设置", d: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
];

export function SidebarCollapsed({ onExpand, onNewChat }: SidebarCollapsedProps) {
  const pathname = usePathname();

  return (
    <div className="flex w-14 shrink-0 flex-col items-center border-r border-stone-300/40 bg-[#EEECE2] py-3">
      {/* Top: sidebar toggle + new chat */}
      <div className="group relative mb-2">
        <button
          type="button"
          onClick={onExpand}
          aria-label="切换侧栏"
          title="会话侧栏"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-300/40 hover:text-stone-700"
        >
          <svg data-testid="sidebar-toggle-open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
        <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-stone-800 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
          会话侧栏
        </span>
      </div>

      <div className="group relative">
        <button
          type="button"
          onClick={onNewChat}
          aria-label="新建对话"
          title="新建对话"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-300/40 hover:text-stone-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-800 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
          新建对话
        </span>
      </div>

      {/* Bottom: navigation links */}
      <div className="mt-auto flex flex-col items-center gap-1">
        {tools.map((tool) => {
          const active = pathname === tool.href;
          return (
            <div key={tool.href} className="group relative">
              <Link
                href={tool.href}
                aria-label={tool.label}
                title={tool.label}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                  active
                    ? "bg-stone-200/80 text-stone-800"
                    : "text-stone-500 hover:bg-stone-300/40 hover:text-stone-700"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tool.d} />
                </svg>
              </Link>
              <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-800 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
                {tool.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
