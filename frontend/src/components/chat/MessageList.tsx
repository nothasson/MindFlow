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
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}-${message.content}`}
            message={message}
          />
        ))}

        {isLoading ? (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4A574] text-xs font-semibold text-white">
              M
            </div>
            <div className="pt-1 text-sm text-stone-500">思考中...</div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
