import { useState, type ReactNode } from "react";

import { SidebarCollapsed } from "./SidebarCollapsed";

interface AppShellProps {
  sidebar: (onCollapse: () => void) => ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const expandSidebar = () => setIsSidebarOpen(true);
  const collapseSidebar = () => setIsSidebarOpen(false);

  return (
    <main className="flex h-screen bg-[#EEECE2] text-stone-800">
      {isSidebarOpen ? (
        <aside className="flex w-72 shrink-0 flex-col">
          {sidebar(collapseSidebar)}
        </aside>
      ) : (
        <SidebarCollapsed onExpand={expandSidebar} />
      )}

      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </main>
  );
}
