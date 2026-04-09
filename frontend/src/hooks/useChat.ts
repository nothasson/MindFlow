"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { sendMessageStream, sendEchoStream } from "@/lib/api";
import type { Message } from "@/lib/types";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      // /echo 命令：走回声测试接口，用于测试 Markdown/Mermaid 渲染
      const isEcho = trimmed.startsWith("/echo ");
      const displayContent = isEcho ? trimmed.slice(6) : trimmed;

      const userMessage: Message = { role: "user", content: displayContent };
      const nextMessages = [...messagesRef.current, userMessage];

      const assistantPlaceholder: Message = { role: "assistant", content: "" };
      setMessages([...nextMessages, assistantPlaceholder]);
      setError(null);
      setIsLoading(true);
      setIsStreaming(true);

      // 共用的回调
      const onChunk = (chunk: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      };
      const onDone = () => {
        setIsLoading(false);
        setIsStreaming(false);
      };
      const onError = (errMsg: string) => {
        setError(errMsg);
        setIsLoading(false);
        setIsStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last.role === "assistant" && last.content === "") {
            return prev.slice(0, -1);
          }
          return prev;
        });
      };

      if (isEcho) {
        await sendEchoStream(displayContent, onChunk, onDone, onError);
      } else {
        await sendMessageStream(
          nextMessages,
          conversationId,
          onChunk,
          onDone,
          onError,
          (id) => { setConversationId(id); },
        );
      }
    },
    [isLoading, conversationId],
  );

  const loadConversation = useCallback((id: string, msgs: Message[]) => {
    setConversationId(id);
    setMessages(msgs);
    setError(null);
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    loadConversation,
    newConversation,
  };
}
