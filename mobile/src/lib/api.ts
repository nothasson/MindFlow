import type {
  AuthResponse,
  CalendarDay,
  ChatRequest,
  ChatResponse,
  Conversation,
  Course,
  CourseSection,
  DailyBriefing,
  DashboardStats,
  ExamPlan,
  HeatmapDay,
  KnowledgeGraph,
  KnowledgeSourceLink,
  LLMProviderSettings,
  MemorySearchResult,
  Message,
  QuizConversationResponse,
  QuizQuestion,
  QuizSubmitResult,
  RecentConversation,
  RecentKnowledge,
  Resource,
  ResourceUploadResult,
  ReviewItem,
  SSEEvent,
  User,
  WrongBookEntry,
  WrongBookStats,
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
  options?: RequestInit,
  timeoutMs: number = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error || `请求失败 (${response.status})`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("请求超时，请检查网络或稍后重试");
    }
    if (error instanceof Error && error.message === "Network request failed") {
      throw new Error("网络连接失败，请检查后端地址或网络状态");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

export async function deleteKnowledgeConcept(concept: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/knowledge/concept/${encodeURIComponent(concept)}`, {
    method: "DELETE",
    headers,
  });
}

export async function getRecentKnowledge(): Promise<RecentKnowledge> {
  const headers = await authHeaders();
  return request("/api/knowledge/recent", { headers });
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
  return request<DashboardStats>(
    "/api/dashboard/stats",
    { headers }
  );
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
  }, 60000); // 网页抓取 + AI 解析，给 60 秒
}

export async function uploadResource(
  file: { uri: string; name: string; type: string }
): Promise<ResourceUploadResult> {
  const token = await getToken();
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await fetch(`${API_URL}/api/resources/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string })?.error || "上传失败");
  }
  return response.json();
}

export async function getResources(): Promise<Resource[]> {
  const headers = await authHeaders();
  const data = await request<{ resources: Resource[] }>("/api/resources", {
    headers,
  });
  return data.resources;
}

export async function deleteResource(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/resources/${id}`, { method: "DELETE", headers });
}

// ===== 复习 API =====

export async function getReviewDue(): Promise<ReviewItem[]> {
  const headers = await authHeaders();
  const data = await request<{ items: ReviewItem[] }>("/api/review/due", {
    headers,
  });
  return data.items;
}

export async function getReviewUpcoming(): Promise<ReviewItem[]> {
  const headers = await authHeaders();
  const data = await request<{ items: ReviewItem[] }>(
    "/api/review/upcoming",
    { headers }
  );
  return data.items;
}

// ===== 测验 API =====

export async function generateQuiz(
  concept: string,
  count?: number
): Promise<QuizQuestion[]> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const data = await request<{ concept: string; questions: QuizQuestion[] }>(
    "/api/quiz/generate",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ concept, count: count ?? 1 }),
    },
    60000 // 生成题目需要 LLM，给 60 秒
  );
  return data.questions || [];
}

export async function submitQuiz(
  concept: string,
  question: string,
  answer: string
): Promise<QuizSubmitResult> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  return request("/api/quiz/submit", {
    method: "POST",
    headers,
    body: JSON.stringify({ concept, question, answer }),
  }, 60000); // LLM 评分，给 60 秒
}

export async function quizAnkiRate(
  concept: string,
  rating: number
): Promise<void> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  await request("/api/quiz/anki-rate", {
    method: "POST",
    headers,
    body: JSON.stringify({ concept, rating }),
  });
}

export async function quizConversation(
  concept: string,
  message: string,
  sessionId?: string
): Promise<QuizConversationResponse> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  return request("/api/quiz/conversation", {
    method: "POST",
    headers,
    body: JSON.stringify({ concept, message, session_id: sessionId }),
  }, 60000); // LLM 对话式考察，给 60 秒
}

// ===== 错题本 API =====

export async function getWrongBook(
  errorType?: string
): Promise<WrongBookEntry[]> {
  const headers = await authHeaders();
  const query = errorType ? `?error_type=${errorType}` : "";
  const data = await request<{ entries: WrongBookEntry[] }>(
    `/api/wrongbook${query}`,
    { headers }
  );
  return data.entries;
}

export async function getWrongBookStats(): Promise<WrongBookStats> {
  const headers = await authHeaders();
  return request("/api/wrongbook/stats", { headers });
}

export async function markWrongBookReviewed(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/wrongbook/${id}/review`, {
    method: "POST",
    headers,
  });
}

export async function deleteWrongBookEntry(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/wrongbook/${id}`, { method: "DELETE", headers });
}

// ===== 设置 API =====

export async function getProviderSettings(): Promise<LLMProviderSettings> {
  const headers = await authHeaders();
  return request("/api/settings/provider", { headers });
}

export async function setProvider(name: string): Promise<void> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  await request("/api/settings/provider", {
    method: "PUT",
    headers,
    body: JSON.stringify({ provider: name }),
  });
}

export async function getExamPlans(): Promise<ExamPlan[]> {
  const headers = await authHeaders();
  const data = await request<{ plans: ExamPlan[] }>("/api/exam-plans", {
    headers,
  });
  return data.plans;
}

export async function createExamPlan(plan: {
  title: string;
  exam_date: string;
  concepts: string[];
  acceleration_factor?: number;
}): Promise<ExamPlan> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  return request("/api/exam-plans", {
    method: "POST",
    headers,
    body: JSON.stringify(plan),
  });
}

export async function deleteExamPlan(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/exam-plans/${id}`, { method: "DELETE", headers });
}

// ===== 记忆/学习历程 API =====

export async function getRecentConversations(): Promise<RecentConversation[]> {
  const headers = await authHeaders();
  const data = await request<{ conversations: RecentConversation[] }>(
    "/api/conversations/recent",
    { headers }
  );
  return data.conversations;
}

export async function getStatsCalendar(): Promise<CalendarDay[]> {
  const headers = await authHeaders();
  const data = await request<{ days: CalendarDay[] }>(
    "/api/stats/calendar",
    { headers }
  );
  return data.days;
}

export async function searchMemory(
  query: string
): Promise<MemorySearchResult[]> {
  const headers = await authHeaders();
  const data = await request<{ results: MemorySearchResult[] }>(
    `/api/memory/search?q=${encodeURIComponent(query)}`,
    { headers }
  );
  return data.results;
}

// ===== 课程 API =====

export async function getCourses(): Promise<Course[]> {
  const headers = await authHeaders();
  const data = await request<{ courses: Course[] }>("/api/courses", {
    headers,
  });
  return data.courses;
}

export async function getCourse(
  id: string
): Promise<{ course: Course; sections: CourseSection[] }> {
  const headers = await authHeaders();
  return request(`/api/courses/${id}`, { headers });
}

export async function deleteCourse(id: string): Promise<void> {
  const headers = await authHeaders();
  await request(`/api/courses/${id}`, { method: "DELETE", headers });
}

export async function generateCourse(
  resourceId: string,
  difficulty?: string
): Promise<{ course: Course; sections: CourseSection[] }> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  const body: Record<string, string> = {};
  if (difficulty) {
    body.difficulty = difficulty;
  }
  return request(`/api/resources/${resourceId}/generate-course`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, 120000); // 课程生成需要 LLM 处理，给 120 秒
}

// ===== Prompt 模板 API =====

/** Prompt 模板映射，key 为场景名，value 为带 {{变量}} 占位符的模板字符串 */
export type PromptTemplates = Record<string, string>;

/** 默认 prompt 模板（后端不可用时的 fallback） */
const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  learn_resource: "我想基于资料「{{filename}}」开始学习，请先帮我梳理重点知识点。",
  learn_resource_default: "我想基于刚上传的资料开始学习，请先帮我梳理重点知识点。",
  learn_concept: "我想学习知识点「{{concept}}」，请帮我深入理解这个概念。",
  learn_course_section: "我想学习课程「{{course_title}}」的第 {{section_index}} 章「{{section_title}}」。\n\n学习目标：\n{{learning_objectives}}\n\n请用苏格拉底式对话引导我理解这些内容。",
  learn_course: "我想学习课程「{{course_title}}」，请帮我梳理重点知识点。",
  learn_course_default: "我想开始课程学习",
  review_concept: "复习一下「{{concept}}」",
  learn_new_concept: "我想学习「{{concept}}」",
  quiz_concept: "请针对「{{concept}}」出一道测试题",
};

/** 缓存已获取的模板 */
let _cachedTemplates: PromptTemplates | null = null;

/** 获取 prompt 模板，带缓存和 fallback */
export async function getPromptTemplates(): Promise<PromptTemplates> {
  if (_cachedTemplates) return _cachedTemplates;
  try {
    const data = await request<{ templates: PromptTemplates }>(
      "/api/prompt-templates"
    );
    _cachedTemplates = data.templates;
    return _cachedTemplates;
  } catch {
    // 后端不可用时使用默认模板
    return DEFAULT_PROMPT_TEMPLATES;
  }
}

/** 用变量填充模板中的 {{变量}} 占位符 */
export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => vars[key] ?? `{{${key}}}`
  );
}
