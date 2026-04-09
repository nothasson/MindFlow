import type { ChatRequest, ChatResponse, Message, SSEEvent } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** 非流式发送（保留兼容） */
export async function sendMessage(messages: Message[]): Promise<Message> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages } satisfies ChatRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(errorBody?.error || `请求失败 (${response.status})`);
    }

    const data = (await response.json()) as ChatResponse;
    return data.message;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("请求超时，请稍后重试");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** 流式发送，通过回调逐 chunk 输出 */
export async function sendMessageStream(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    onError("请求超时，请稍后重试");
  }, 60000);

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, stream: true } satisfies ChatRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      onError(errorBody?.error || `请求失败 (${response.status})`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("浏览器不支持流式读取");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const json = trimmed.slice(6);
        try {
          const event = JSON.parse(json) as SSEEvent;
          if (event.error) {
            onError(event.error);
            reader.cancel();
            return;
          }
          if (event.done) {
            onDone();
            return;
          }
          if (event.content) {
            onChunk(event.content);
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return; // 超时已在上面处理
    }
    onError(err instanceof Error ? err.message : "发送消息失败");
  } finally {
    clearTimeout(timeout);
  }
}
