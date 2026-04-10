import type { ChatRequest, ChatResponse, Conversation, DailyBriefing, KnowledgeGraph, Message, ResourceUploadResult, SSEEvent } from "@/lib/types";

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
  conversationId: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  onConversationId?: (id: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    onError("请求超时，请稍后重试");
  }, 60000);

  try {
    const body: ChatRequest = { messages, stream: true };
    if (conversationId) {
      body.conversation_id = conversationId;
    }
    // 从 localStorage 读取教学风格偏好
    if (typeof window !== "undefined") {
      const style = localStorage.getItem("mindflow_teaching_style");
      if (style) {
        body.style = style;
      }
    }

    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        if (!trimmed.startsWith("data:")) continue;

        const json = trimmed.startsWith("data: ")
          ? trimmed.slice(6)
          : trimmed.slice(5);
        try {
          const event = JSON.parse(json) as SSEEvent;
          if (event.error) {
            onError(event.error);
            reader.cancel();
            return;
          }
          if (event.conversation_id && onConversationId) {
            onConversationId(event.conversation_id);
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
      return;
    }
    onError(err instanceof Error ? err.message : "发送消息失败");
  } finally {
    clearTimeout(timeout);
  }
}

/** 获取会话列表 */
export async function getConversations(): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/api/conversations`);
  if (!response.ok) throw new Error("获取会话列表失败");
  const data = (await response.json()) as { conversations: Conversation[] };
  return data.conversations;
}

/** 获取会话详情（含消息） */
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  const response = await fetch(`${API_URL}/api/conversations/${id}`);
  if (!response.ok) throw new Error("获取会话详情失败");
  return response.json();
}

/** 删除会话 */
export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/conversations/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("删除会话失败");
}

/** 获取知识图谱数据 */
export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const response = await fetch(`${API_URL}/api/knowledge/graph`);
  if (!response.ok) throw new Error("获取知识图谱失败");
  return response.json();
}

/** 回声测试：逐字流式返回用户内容，用于测试 Markdown/Mermaid 渲染和打字机效果 */
export async function sendEchoStream(
  content: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, delay_ms: 30 }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
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
        if (!trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
        try {
          const event = JSON.parse(jsonStr) as SSEEvent;
          if (event.error) { onError(event.error); reader.cancel(); return; }
          if (event.done) { onDone(); return; }
          if (event.content) { onChunk(event.content); }
        } catch { /* 跳过 */ }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "echo 请求失败");
  }
}

/** 上传资料并通过后端转发给 AI 服务 */
export async function uploadResource(file: File): Promise<ResourceUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/resources/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error || `上传失败 (${response.status})`);
  }

  return response.json();
}

/** 获取今日学习简报 */
export async function getDailyBriefing(): Promise<DailyBriefing> {
  const response = await fetch(`${API_URL}/api/daily-briefing`);
  if (!response.ok) throw new Error("获取学习简报失败");
  const data = (await response.json()) as { briefing: DailyBriefing };
  return data.briefing;
}

/** 导入网页链接并通过后端转发给 AI 服务 */
export async function importUrlResource(url: string): Promise<ResourceUploadResult> {
  const response = await fetch(`${API_URL}/api/resources/import-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error || `导入失败 (${response.status})`);
  }

  return response.json();
}
