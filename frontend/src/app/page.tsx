"use client";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const { messages, isLoading, error, sendMessage } = useChat();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col gap-6">
        <header className="space-y-3 text-center">
          <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm">
            AI Native 自适应学习平台
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            MindFlow
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            不是直接给答案，而是通过苏格拉底式提问引导你一步步思考、理解和掌握知识。
          </p>
        </header>

        <section className="flex flex-1 flex-col gap-4">
          <MessageList messages={messages} isLoading={isLoading} />

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <ChatInput isLoading={isLoading} onSend={sendMessage} />
        </section>
      </div>
    </main>
  );
}
