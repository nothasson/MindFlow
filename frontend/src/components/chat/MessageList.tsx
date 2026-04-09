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

  return (
    <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={`${message.role}-${index}-${message.content}`}
          message={message}
        />
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
            MindFlow 正在思考下一步该怎么引导你...
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
