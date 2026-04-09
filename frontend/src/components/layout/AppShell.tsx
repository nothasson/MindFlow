import { useState, type ReactNode } from "react";

import { SidebarToggle } from "./SidebarToggle";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <main className="relative flex h-screen bg-[#EEECE2] text-stone-800">
      <aside className="hidden w-72 shrink-0 flex-col bg-[#1F1D1A] lg:flex" role="complementary">
        {sidebar}
      </aside>

      {isSidebarOpen ? (
        <>
          <button
            type="button"
            aria-label="关闭侧栏遮罩"
            data-testid="sidebar-overlay"
            className="fixed inset-0 z-40 bg-black/25 lg:hidden"
            onClick={closeSidebar}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#1F1D1A] shadow-2xl lg:hidden">
            {sidebar}
          </aside>
        </>
      ) : null}

      <section className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute left-4 top-4 z-30">
          <SidebarToggle isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        </div>
        {children}
      </section>
    </main>
  );
}
