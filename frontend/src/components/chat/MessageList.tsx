"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import type { Message } from "@/lib/types";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 流式模式下：最后一条 assistant 有内容了就不再显示"思考中"
  const lastMsg = messages[messages.length - 1];
  const showLoading =
    isLoading && !(lastMsg?.role === "assistant" && lastMsg.content.length > 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}-${message.content}`}
            message={message}
          />
        ))}

        {showLoading ? (
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C67A4A] text-[10px] font-bold text-white">
              M
            </div>
            <div className="pt-0.5 text-sm text-stone-400">思考中...</div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
