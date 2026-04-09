"use client";

import { useCallback, useState } from "react";

import { sendMessage as requestAssistantMessage } from "@/lib/api";
import type { Message } from "@/lib/types";

const initialMessages: Message[] = [];

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const userMessage: Message = {
        role: "user",
        content: trimmed,
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setError(null);
      setIsLoading(true);

      try {
        const assistantMessage = await requestAssistantMessage(nextMessages);
        setMessages([...nextMessages, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "发送消息失败");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages],
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}
