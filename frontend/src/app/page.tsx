"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { BrandMark } from "@/components/layout/BrandMark";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChat } from "@/hooks/useChat";
import { getConversations, getConversation, deleteConversation } from "@/lib/api";
import type { Conversation } from "@/lib/types";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    loadConversation,
    newConversation,
  } = useChat();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const requestedConversationId = searchParams?.get("conversation") ?? null;
  const learnQuery = searchParams?.get("q") ?? null;

  // 从知识图谱跳转过来时，自动发起学习对话
  const learnQueryHandled = useRef(false);
  useEffect(() => {
    if (learnQuery && !learnQueryHandled.current && !isLoading && messages.length === 0) {
      learnQueryHandled.current = true;
      sendMessage(learnQuery);
      // 清除 URL 参数，防止刷新重复触发
      router.replace("/");
    }
  }, [learnQuery, isLoading, messages.length, sendMessage, router]);

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

  // 流式结束后刷新会话列表
  useEffect(() => {
    if (!isLoading && conversationId) {
      refreshConversations();
    }
  }, [isLoading, conversationId, refreshConversations]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      try {
        const data = await getConversation(id);
        loadConversation(
          id,
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      } catch {
        // 加载失败静默处理
      }
    },
    [loadConversation],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        if (conversationId === id) {
          newConversation();
        }
        refreshConversations();
      } catch {
        // 删除失败静默处理
      }
    },
    [conversationId, newConversation, refreshConversations],
  );

  const handleNewChat = useCallback(() => {
    newConversation();
  }, [newConversation]);

  useEffect(() => {
    if (!requestedConversationId || requestedConversationId === conversationId) {
      return;
    }

    handleSelectConversation(requestedConversationId);
  }, [requestedConversationId, conversationId, handleSelectConversation]);

  const hasMessages = messages.length > 0;

  return (
    <AppShell
      onNewChat={handleNewChat}
      sidebar={(onCollapse) => (
        <Sidebar
          conversations={conversations}
          currentConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleNewChat}
          onCollapse={onCollapse}
        />
      )}
    >
      {!hasMessages ? (
        <div className="flex flex-1 flex-col items-center px-4 pt-[28vh]">
          <div className="mb-10 flex items-center gap-4">
            <BrandMark className="h-10 w-10 text-[#C67A4A]" />
            <h1
              className="text-5xl tracking-tight text-stone-800 sm:text-[3.5rem]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              MindFlow
            </h1>
          </div>

          <div className="w-full max-w-[46rem]">
            {error ? (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <ChatInput isLoading={isLoading} onSend={sendMessage} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden pt-16">
            <MessageList messages={messages} isLoading={isLoading} isStreaming={isStreaming} />
          </div>

          {error ? (
            <div className="mx-auto max-w-3xl px-4">
              <div className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
            <ChatInput isLoading={isLoading} onSend={sendMessage} />
          </div>
        </>
      )}
    </AppShell>
  );
}
