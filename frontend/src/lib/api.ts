import type { ChatRequest, ChatResponse, Message } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function sendMessage(messages: Message[]): Promise<Message> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages } satisfies ChatRequest),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(errorBody?.error || "发送消息失败");
  }

  const data = (await response.json()) as ChatResponse;
  return data.message;
}
