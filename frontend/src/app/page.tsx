"use client";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const { messages, isLoading, error, sendMessage } = useChat();

  return (
    <AppShell sidebar={<Sidebar />}>
      <div className="flex flex-1 flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <h2 className="mb-2 text-2xl font-semibold text-stone-800">
              有什么想学的？
            </h2>
            <p className="mb-8 max-w-md text-center text-sm text-stone-500">
              输入你的问题，我会通过提问引导你一步步理解。
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>
        )}

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
      </div>
    </AppShell>
  );
}
