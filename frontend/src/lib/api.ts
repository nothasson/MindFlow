import type { ChatRequest, ChatResponse, Conversation, DailyBriefing, KnowledgeGraph, KnowledgeSourceLink, Message, ResourceUploadResult, SSEEvent } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// ===== Token 管理 =====

/** 获取本地存储的 JWT token */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mindflow_token");
}

/** 构建带 Authorization header 的请求头 */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ===== 认证 API =====

/** 认证响应 */
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    created_at: string;
  };
}

/** 用户注册 */
export async function register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName ?? "" }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `注册失败 (${response.status})`);
  }
  return response.json();
}

/** 用户登录 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `登录失败 (${response.status})`);
  }
  return response.json();
}

/** 获取当前用户信息 */
export async function getMe(): Promise<AuthResponse["user"]> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error("获取用户信息失败");
  }
  const data = (await response.json()) as { user: AuthResponse["user"] };
  return data.user;
}

/** 非流式发送（保留兼容） */
export async function sendMessage(messages: Message[]): Promise<Message> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
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
      headers: authHeaders({ "Content-Type": "application/json" }),
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
  const response = await fetch(`${API_URL}/api/conversations`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("获取会话列表失败");
  const data = (await response.json()) as { conversations: Conversation[] };
  return data.conversations;
}

/** 获取会话详情（含消息） */
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  const response = await fetch(`${API_URL}/api/conversations/${id}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("获取会话详情失败");
  return response.json();
}

/** 删除会话 */
export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/conversations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除会话失败");
}

/** 获取知识图谱数据 */
export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const response = await fetch(`${API_URL}/api/knowledge/graph`, {
    headers: authHeaders(),
  });
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
      headers: authHeaders({ "Content-Type": "application/json" }),
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
    headers: authHeaders(),
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
  const response = await fetch(`${API_URL}/api/daily-briefing`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("获取学习简报失败");
  const data = (await response.json()) as { briefing: DailyBriefing };
  return data.briefing;
}

/** 导入网页链接并通过后端转发给 AI 服务 */
export async function importUrlResource(url: string): Promise<ResourceUploadResult> {
  const response = await fetch(`${API_URL}/api/resources/import-url`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error || `导入失败 (${response.status})`);
  }

  return response.json();
}

/** 查询知识点的所有来源（资料、测验、对话） */
export async function getKnowledgeSources(concept: string): Promise<KnowledgeSourceLink[]> {
  const response = await fetch(`${API_URL}/api/knowledge/sources?concept=${encodeURIComponent(concept)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("获取知识点来源失败");
  const data = (await response.json()) as { concept: string; sources: KnowledgeSourceLink[] };
  return data.sources;
}
