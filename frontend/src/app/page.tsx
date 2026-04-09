"use client";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const { messages, isLoading, error, sendMessage } = useChat();

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {!hasMessages ? (
        /* 空态：居中标题 + 输入框，对齐 claude.ai 首屏 */
        <div className="flex flex-1 flex-col items-center px-4 pt-[28vh]">
          <div className="mb-10 flex items-center gap-4">
            <span className="text-4xl text-[#C67A4A]">✺</span>
            <h1
              className="text-5xl tracking-tight text-stone-800 sm:text-[3.5rem]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              MindFlow
            </h1>
          </div>

          <div className="w-full max-w-[46rem]">
            <ChatInput isLoading={isLoading} onSend={sendMessage} />
          </div>
        </div>
      ) : (
        /* 有消息态：对话列表 + 底部输入 */
        <>
          <div className="flex-1 overflow-hidden">
            <MessageList messages={messages} isLoading={isLoading} />
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
    </div>
  );
}
