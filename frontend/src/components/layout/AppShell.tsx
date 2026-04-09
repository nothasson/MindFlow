import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <main className="flex h-screen bg-[#FAF9F6] text-stone-800">
      <aside className="hidden w-72 shrink-0 flex-col bg-[#2A2520] lg:flex">
        {sidebar}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </main>
  );
}
