import { useState, type ReactNode } from "react";
import { useAuth, type User } from "@/hooks/useAuth";

import { SidebarCollapsed } from "./SidebarCollapsed";

interface AppShellProps {
  sidebar: (onCollapse: () => void, user: User | null, onLogout: () => void) => ReactNode;
  onNewChat?: () => void;
  children: ReactNode;
}

export function AppShell({ sidebar, onNewChat, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const expandSidebar = () => setIsSidebarOpen(true);
  const collapseSidebar = () => setIsSidebarOpen(false);

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
