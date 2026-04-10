"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { BrandMark } from "@/components/layout/BrandMark";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChat } from "@/hooks/useChat";
import { getConversations, getConversation, deleteConversation, getDailyBriefing } from "@/lib/api";
import type { Conversation, DailyBriefing } from "@/lib/types";

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
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingCollapsed, setBriefingCollapsed] = useState(true);
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
    // 加载晨间简报
    getDailyBriefing().then((b) => setBriefing(b)).catch(() => {});
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
        <div className="flex flex-1 flex-col items-center px-4 pt-[18vh]">
          <div className="mb-8 flex items-center gap-4">
            <BrandMark className="h-10 w-10 text-[#C67A4A]" />
            <h1
              className="text-5xl tracking-tight text-stone-800 sm:text-[3.5rem]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              MindFlow
            </h1>
          </div>

          {/* 晨间简报 — 紧凑模式 */}
          {briefing && briefingCollapsed && (
            <button
              type="button"
              onClick={() => setBriefingCollapsed(false)}
              className="mb-4 flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
            >
              <span>📋</span>
              今日建议：{briefing.review_items.length} 项复习
              {briefing.new_items.length > 0 ? `，${briefing.new_items.length} 项新学` : ""}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          )}
          {briefing && !briefingCollapsed && (
            <div className="mb-4 w-full max-w-[46rem] rounded-xl border border-stone-200 bg-white px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate text-xs text-stone-500">📋 {briefing.greeting}</span>
                <button
                  type="button"
                  onClick={() => setBriefingCollapsed(true)}
                  className="ml-2 shrink-0 rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-400 transition hover:bg-stone-50 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {briefing.review_items.map((item, i) => (
                  <button
                    key={`r-${i}`}
                    type="button"
                    onClick={() => sendMessage(`复习一下「${item.concept}」`)}
                    className="rounded-full border border-[#C67A4A]/20 bg-[#C67A4A]/5 px-2.5 py-1 text-xs text-[#C67A4A] transition hover:bg-[#C67A4A]/15"
                  >
                    复习 {item.concept}
                  </button>
                ))}
                {briefing.new_items.map((item, i) => (
                  <button
                    key={`n-${i}`}
                    type="button"
                    onClick={() => sendMessage(`我想学习「${item.concept}」`)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-600 transition hover:bg-stone-100"
                  >
                    学习 {item.concept}
                  </button>
                ))}
                {briefing.quiz_suggestion && (
                  <button
                    type="button"
                    onClick={() => sendMessage(`测验一下「${briefing.quiz_suggestion!.concept}」`)}
                    className="rounded-full bg-stone-800 px-2.5 py-1 text-xs text-white transition hover:bg-stone-700"
                  >
                    测验 {briefing.quiz_suggestion.concept}
                  </button>
                )}
              </div>
            </div>
          )}

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
