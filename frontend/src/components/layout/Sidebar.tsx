import type { Conversation } from "@/lib/types";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  conversations?: Conversation[];
  currentConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onNewChat?: () => void;
  onCollapse?: () => void;
}

const navLinks = [
  { href: "/knowledge", label: "知识图谱", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { href: "/dashboard", label: "学习仪表盘", d: "M3 3v18h18M9 17V9m4 8V5m4 12v-4" },
  { href: "/review", label: "复习计划", d: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
];

export function Sidebar({
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  onCollapse,
}: SidebarProps) {
  const pathname = usePathname();

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
            onClick={onNewChat}
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
        <button
          type="button"
          onClick={onNewChat}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
            !currentConversationId
              ? "bg-stone-200/70 font-medium text-stone-800"
              : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-800"
          }`}
        >
          新建对话
        </button>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-2">
        <p className="mb-2 text-[11px] font-medium text-stone-400">最近对话</p>
        {conversations.length > 0 ? (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <div key={conv.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectConversation?.(conv.id)}
                  className={`flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                    currentConversationId === conv.id
                      ? "bg-stone-200/70 font-medium text-stone-800"
                      : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-800"
                  }`}
                >
                  {conv.title || "未命名会话"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation?.(conv.id);
                  }}
                  className="ml-1 hidden h-6 w-6 shrink-0 items-center justify-center rounded text-stone-400 transition hover:bg-stone-200 hover:text-stone-600 group-hover:flex"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-stone-400">暂无会话</p>
        )}
      </div>

      <div className="border-t border-stone-300/40 px-2 pt-3">
        <div className="space-y-0.5">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-stone-200/70 font-medium text-stone-800"
                    : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-800"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={link.d} />
                </svg>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-stone-300/40 px-2 pt-3">
        <div className="flex h-9 items-center gap-2.5 rounded-lg px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-300 text-stone-500" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="5" />
            </svg>
          </div>
          <span className="text-sm text-stone-600">未登录</span>
        </div>
      </div>
    </div>
  );
}
