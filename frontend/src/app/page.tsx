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
      <header className="rounded-3xl border border-white/70 bg-white/85 px-6 py-6 shadow-[0_12px_40px_rgba(148,163,184,0.12)] backdrop-blur">
        <p className="text-xs font-semibold tracking-wide text-amber-600">
          AI Native 自适应学习平台
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          MindFlow
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          不直接给答案，而是通过温和追问和关键提示，帮你把“会做题”变成“会思考”。
        </p>
      </header>

      <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-900 lg:hidden">
        你正在使用移动视图。知识图谱、复习计划和学习进度将会出现在后续版本中。
      </div>

      <section className="mt-5 flex flex-1 flex-col rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-[0_10px_35px_rgba(148,163,184,0.10)] sm:p-5">
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
