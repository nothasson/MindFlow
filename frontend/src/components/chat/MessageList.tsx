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
    <div className="flex-1 space-y-4 overflow-y-auto rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={`${message.role}-${index}-${message.content}`}
          message={message}
        />
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-amber-700 shadow-sm">
            MindFlow 正在整理问题，并准备一个更有启发性的提问...
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}
