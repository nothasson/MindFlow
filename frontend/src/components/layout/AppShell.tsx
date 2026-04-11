import { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, type User } from "@/hooks/useAuth";

import { SidebarCollapsed } from "./SidebarCollapsed";

interface AppShellProps {
  sidebar: (onCollapse: () => void, user: User | null, onLogout: () => void) => ReactNode;
  onNewChat?: () => void;
  children: ReactNode;
}

export function AppShell({ sidebar, onNewChat, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 路由守卫：未登录时跳转 /login（/login 页本身除外）
  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  const expandSidebar = () => setIsSidebarOpen(true);
  const collapseSidebar = () => setIsSidebarOpen(false);

  // 加载中显示空白，避免闪烁
  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#EEECE2]">
        <p className="text-sm text-stone-400">加载中...</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-[#EEECE2] text-stone-800">
      {isSidebarOpen ? (
        <aside className="flex w-72 shrink-0 flex-col border-r border-stone-300/40">
          {sidebar(collapseSidebar, user, logout)}
        </aside>
      ) : (
        <SidebarCollapsed onExpand={expandSidebar} onNewChat={onNewChat} user={user} onLogout={logout} />
      )}

      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </main>
  );
}
