import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#fffdf8_45%,_#fffefc_100%)] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl gap-6">
        <aside className="hidden w-80 shrink-0 lg:block">{sidebar}</aside>
        <section className="flex min-w-0 flex-1 flex-col">{children}</section>
      </div>
    </main>
  );
}
