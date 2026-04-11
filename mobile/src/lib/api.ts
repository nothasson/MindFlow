import type {
  AuthResponse,
  ChatRequest,
  ChatResponse,
  Conversation,
  DailyBriefing,
  DashboardStats,
  HeatmapDay,
  KnowledgeGraph,
  KnowledgeSourceLink,
  Message,
  ResourceUploadResult,
  SSEEvent,
  User,
} from "./types";
import { API_URL } from "./config";
import { getTeachingStyle, getToken } from "./storage";

// ===== 请求工具 =====

async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const token = await getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || `请求失败 (${response.status})`);
  }
  return response.json();
}

// ===== 认证 API =====

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName ?? "" }),
  });
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<User> {
  const headers = await authHeaders();
  const data = await request<{ user: User }>("/api/auth/me", { headers });
  return data.user;
}

// ===== 聊天 API =====

export async function sendMessage(messages: Message[]): Promise<Message> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const data = await request<ChatResponse>("/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ messages } satisfies ChatRequest),
  });
  return data.message;
}

/**
 * 流式发送消息（SSE）
 *
 * React Native 不原生支持 ReadableStream，
 * 这里用 XMLHttpRequest 手动解析 SSE 流。
 */
export async function sendMessageStream(
  messages: Message[],
  conversationId: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  onConversationId?: (id: string) => void
): Promise<() => void> {
  const body: ChatRequest = { messages, stream: true };
  if (conversationId) {
    body.conversation_id = conversationId;
  }

  const style = await getTeachingStyle();
  if (style) {
    body.style = style;
  }

  const token = await getToken();

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_URL}/api/chat`);
  xhr.setRequestHeader("Content-Type", "application/json");
  if (token) {
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  }

  let buffer = "";
  let lastIndex = 0;

  xhr.onreadystatechange = () => {
    if (xhr.readyState >= 3) {
      const newData = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      buffer += newData;

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
            xhr.abort();
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
  };

  xhr.onerror = () => {
    onError("网络错误，请检查连接");
  };

  xhr.ontimeout = () => {
    onError("请求超时，请稍后重试");
  };

  xhr.timeout = 60000;
  xhr.send(JSON.stringify(body));

  // 返回取消函数
  return () => xhr.abort();
}

// ===== 会话 API =====

export async function getConversations(): Promise<Conversation[]> {
  const headers = await authHeaders();
  const data = await request<{ conversations: Conversation[] }>(
    "/api/conversations",
    { headers }
  );
  return data.conversations;
}

export async function getConversation(
  id: string
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const headers = await authHeaders();
  return request(`/api/conversations/${id}`, { headers });
}

export async function deleteConversation(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/conversations/${id}`, {
    method: "DELETE",
    headers,
  });
}

// ===== 知识图谱 API =====

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const headers = await authHeaders();
  return request("/api/knowledge/graph", { headers });
}

export async function getKnowledgeSources(
  concept: string
): Promise<KnowledgeSourceLink[]> {
  const headers = await authHeaders();
  const data = await request<{ concept: string; sources: KnowledgeSourceLink[] }>(
    `/api/knowledge/sources?concept=${encodeURIComponent(concept)}`,
    { headers }
  );
  return data.sources;
}

// ===== 学习简报 API =====

export async function getDailyBriefing(): Promise<DailyBriefing> {
  const headers = await authHeaders();
  const data = await request<{ briefing: DailyBriefing }>(
    "/api/daily-briefing",
    { headers }
  );
  return data.briefing;
}

// ===== Dashboard API =====

export async function getDashboardStats(): Promise<DashboardStats> {
  const headers = await authHeaders();
  const data = await request<{ stats: DashboardStats }>(
    "/api/dashboard/stats",
    { headers }
  );
  return data.stats;
}

export async function getDashboardHeatmap(): Promise<HeatmapDay[]> {
  const headers = await authHeaders();
  const data = await request<{ heatmap: HeatmapDay[] }>(
    "/api/dashboard/heatmap",
    { headers }
  );
  return data.heatmap;
}

// ===== 资源 API =====

export async function importUrlResource(
  url: string
): Promise<ResourceUploadResult> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  return request("/api/resources/import-url", {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
}
