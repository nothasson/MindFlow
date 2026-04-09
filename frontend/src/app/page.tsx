"use client";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const { messages, isLoading, error, sendMessage } = useChat();

  return (
    <AppShell sidebar={<Sidebar />}>
      <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          MindFlow
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          开始对话后，系统会持续记录你的学习状态，并给出下一步学习建议。
        </p>
      </header>

      <section className="mt-5 flex flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <TopNav />

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <MessageList messages={messages} isLoading={isLoading} />

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <ChatInput isLoading={isLoading} onSend={sendMessage} />
        </div>
      </section>
    </AppShell>
  );
}
