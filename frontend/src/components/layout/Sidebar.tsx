import type { Message } from "@/lib/types";

interface SidebarProps {
  messages?: Message[];
  onCollapse?: () => void;
}

export function Sidebar({ messages = [], onCollapse }: SidebarProps) {
  const hasMessages = messages.length > 0;

  const currentTitle = hasMessages
    ? messages.find((m) => m.role === "user")?.content.slice(0, 30) || "当前会话"
    : null;

  return (
    <div className="flex h-full flex-col bg-[#EEECE2] px-3 py-3 text-stone-700">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-lg font-semibold text-stone-800">MindFlow</span>
        <div className="flex gap-1">
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="收起侧栏"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-0.5 px-1">
        <SidebarItem label="新建对话" active={!hasMessages} />
        <SidebarItem label="搜索" />
      </div>

      <div className="mt-5 px-2">
        <p className="mb-2 text-[11px] font-medium text-stone-400">最近对话</p>
        {currentTitle ? (
          <div className="space-y-0.5">
            <button
              type="button"
              className="w-full truncate rounded-lg bg-stone-200/70 px-3 py-2 text-left text-sm font-medium text-stone-800"
            >
              {currentTitle}
            </button>
          </div>
        ) : (
          <p className="px-1 text-sm text-stone-400">暂无会话</p>
        )}
      </div>

      <div className="mt-auto border-t border-stone-300/40 px-2 pt-3">
        <div className="flex h-9 items-center gap-2.5 rounded-lg px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-400 text-[11px] font-semibold text-white">
            U
          </div>
          <span className="text-sm text-stone-600">未登录</span>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-stone-200/70 font-medium text-stone-800"
          : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-800"
      }`}
    >
      {label}
    </button>
  );
}
