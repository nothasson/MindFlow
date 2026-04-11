"use client";

import { Suspense, useCallback, useEffect, useState, startTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { deleteConversation, getConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";

interface MainShellProps {
  children: ReactNode;
}

export function MainShell({ children }: MainShellProps) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#EEECE2] text-stone-400">加载中...</div>}>
      <MainShellInner>{children}</MainShellInner>
    </Suspense>
  );
}

function MainShellInner({ children }: MainShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentConversationId = pathname === "/" ? searchParams.get("conversation") : null;
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await getConversations();
      startTransition(() => {
        setConversations(list);
      });
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      router.push(`/?conversation=${id}`);
    },
    [router],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        if (currentConversationId === id) {
          router.push("/");
        }
        refreshConversations();
      } catch {
        // 静默失败
      }
    },
    [currentConversationId, refreshConversations, router],
  );

  const handleNewChat = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <AppShell
      onNewChat={handleNewChat}
      sidebar={(onCollapse, user, onLogout) => (
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleNewChat}
          onCollapse={onCollapse}
          user={user}
          onLogout={onLogout}
        />
      )}
    >
      {children}
    </AppShell>
  );
}
