"use client";

import { useCallback, useEffect, useState, startTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { deleteConversation, getConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";

interface MainShellProps {
  children: ReactNode;
}

export function MainShell({ children }: MainShellProps) {
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
      sidebar={(onCollapse) => (
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleNewChat}
          onCollapse={onCollapse}
        />
      )}
    >
      {children}
    </AppShell>
  );
}
