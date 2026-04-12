import type { ChatRequest, ChatResponse, Conversation, DailyBriefing, KnowledgeGraph, KnowledgeSourceLink, Message, Resource, ResourceUploadResult, SSEEvent } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

/** 获取已上传资料列表 */
export async function getResources(): Promise<Resource[]> {
  const response = await fetch(`${API_URL}/api/resources`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("获取资料列表失败");
  const data = (await response.json()) as { resources: Resource[] };
  return data.resources || [];
}

/** 删除资料 */
export async function deleteResource(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/resources/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除失败");
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

// ===== 错题本 API =====

/** 获取错题列表 */
export async function getWrongBook(): Promise<{ entries: WrongBookEntry[] }> {
  const response = await fetch(`${API_URL}/api/wrongbook`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取错题本失败");
  return response.json();
}

/** 获取错题统计 */
export async function getWrongBookStats(): Promise<{ stats: WrongBookStat[] }> {
  const response = await fetch(`${API_URL}/api/wrongbook/stats`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取错题统计失败");
  return response.json();
}

/** 标记错题已复习 */
export async function reviewWrongBook(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/wrongbook/${id}/review`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("标记复习失败");
}

/** 删除错题 */
export async function deleteWrongBook(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/wrongbook/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除错题失败");
}

// ===== 仪表盘 API =====

/** 获取仪表盘统计数据 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_URL}/api/dashboard/stats`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取统计数据失败");
  return response.json();
}

/** 获取学习热力图数据 */
export async function getDashboardHeatmap(): Promise<{ heatmap: HeatmapEntry[] }> {
  const response = await fetch(`${API_URL}/api/dashboard/heatmap`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取热力图失败");
  return response.json();
}

/** 获取掌握度分布 */
export async function getMasteryDistribution(): Promise<MasteryDistribution> {
  const response = await fetch(`${API_URL}/api/dashboard/mastery-distribution`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取掌握度分布失败");
  return response.json();
}

// ===== 学习历程 API =====

/** 获取最近对话 */
export async function getRecentConversations(): Promise<{ conversations: ConvSummary[] }> {
  const response = await fetch(`${API_URL}/api/conversations/recent`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取最近对话失败");
  return response.json();
}

/** 获取最近知识点 */
export async function getRecentKnowledge(): Promise<KnowledgeStats> {
  const response = await fetch(`${API_URL}/api/knowledge/recent`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取知识点失败");
  return response.json();
}

/** 获取日历统计数据 */
export async function getCalendarStats(): Promise<{ days: CalendarDay[] }> {
  const response = await fetch(`${API_URL}/api/stats/calendar`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取日历统计失败");
  return response.json();
}

/** 搜索记忆 */
export async function searchMemory(q: string): Promise<{ results: { source: string; content: string }[] }> {
  const response = await fetch(`${API_URL}/api/memory/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("搜索失败");
  return response.json();
}

// ===== 设置 API =====

/** 获取模型提供方设置 */
export async function getProvider(): Promise<ProviderSettings> {
  const response = await fetch(`${API_URL}/api/settings/provider`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取设置失败");
  return response.json();
}

/** 更新模型提供方 */
export async function updateProvider(data: { provider: string }): Promise<void> {
  const response = await fetch(`${API_URL}/api/settings/provider`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "切换失败");
  }
}

/** 获取考试计划列表 */
export async function getExamPlans(): Promise<{ plans: ExamPlan[] }> {
  const response = await fetch(`${API_URL}/api/exam-plans`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取考试计划失败");
  return response.json();
}

/** 创建考试计划 */
export async function createExamPlan(data: {
  title: string;
  exam_date: string;
  concepts: string[];
  acceleration_factor?: number;
}): Promise<void> {
  const response = await fetch(`${API_URL}/api/exam-plans`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("创建考试计划失败");
}

/** 删除考试计划 */
export async function deleteExamPlan(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/exam-plans/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除考试计划失败");
}

// ===== 知识点 API（补充） =====

/** 删除知识点 */
export async function deleteConcept(concept: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/knowledge/concept/${encodeURIComponent(concept)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除知识点失败");
}

// ===== 资料 API（补充） =====

/** 生成章节课程 */
export async function generateCourse(resourceId: string, difficulty?: string): Promise<{ course: { id: string } }> {
  const response = await fetch(`${API_URL}/api/resources/${resourceId}/generate-course`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ difficulty: difficulty ?? "beginner" }),
  });
  if (!response.ok) throw new Error("生成课程失败");
  return response.json();
}

// ===== 复习 API =====

/** 获取到期复习项 */
export async function getReviewDue(): Promise<{ items: ReviewItem[] }> {
  const response = await fetch(`${API_URL}/api/review/due`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取复习项失败");
  return response.json();
}

/** 获取即将到期复习项 */
export async function getReviewUpcoming(): Promise<{ items: ReviewItem[] }> {
  const response = await fetch(`${API_URL}/api/review/upcoming`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取复习项失败");
  return response.json();
}

// ===== 测验 API =====

/** 题目结构 */
export interface QuizQuestion {
  question: string;
  concept: string;
  hint?: string;
}

/** 生成测验题目 */
export async function generateQuiz(data: { concept: string }): Promise<{ questions: QuizQuestion[]; concept?: string }> {
  const response = await fetch(`${API_URL}/api/quiz/generate`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("出题失败");
  return response.json();
}

/** 提交测验答案 */
export async function submitQuiz(data: { concept: string; question: string; answer: string }): Promise<QuizSubmitResult> {
  const response = await fetch(`${API_URL}/api/quiz/submit`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("提交失败");
  return response.json();
}

/** 对话考察 */
export async function quizConversation(data: {
  concept: string;
  message: string;
  session_id?: string;
  round?: number;
  history?: string;
}): Promise<{ reply: string; round: number; finished: boolean }> {
  const response = await fetch(`${API_URL}/api/quiz/conversation`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("对话考察失败");
  return response.json();
}

/** Anki 评分 */
export async function ankiRate(data: { concept: string; rating: number }): Promise<void> {
  const response = await fetch(`${API_URL}/api/quiz/anki-rate`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("评分失败");
}

// ===== 课程 API =====

/** 获取课程详情 */
export async function getCourse(id: string): Promise<{ course: Course; sections: CourseSection[] }> {
  const response = await fetch(`${API_URL}/api/courses/${id}`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取课程失败");
  return response.json();
}

/** 获取课程列表 */
export async function getCourses(): Promise<{ courses: Course[] }> {
  const response = await fetch(`${API_URL}/api/courses`, { headers: authHeaders() });
  if (!response.ok) throw new Error("获取课程列表失败");
  return response.json();
}

/** 删除课程 */
export async function deleteCourse(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/courses/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("删除课程失败");
}

// ===== 共享类型定义 =====

export interface WrongBookEntry {
  id: string;
  quiz_attempt_id: string;
  concept: string;
  error_type: string;
  question: string;
  user_answer: string;
  reviewed: boolean;
  review_count: number;
  next_review?: string;
  created_at: string;
}

export interface WrongBookStat {
  error_type: string;
  count: number;
}

export interface WeakPoint {
  concept: string;
  confidence: number;
}

export interface DashboardStats {
  total_conversations: number;
  total_messages: number;
  total_resources: number;
  total_courses: number;
  total_days: number;
  streak: number;
  weak_points: WeakPoint[];
  trend: { date: string; count: number }[];
}

export interface HeatmapEntry {
  date: string;
  count: number;
}

export interface MasteryDistribution {
  mastered: number;
  learning: number;
  weak: number;
  total: number;
}

export interface ConvSummary {
  id: string;
  title: string;
  last_message: string;
  message_count: number;
  updated_at: string;
}

export interface KnowledgeStats {
  total: number;
  new: number;
  learning: number;
  mastered: number;
  recent: { concept: string; confidence: number }[];
}

export interface CalendarDay {
  date: string;
  count: number;
}

export interface ProviderSettings {
  active: string;
  providers: { id: string; name: string; model: string }[];
}

export interface ExamPlan {
  id: string;
  title: string;
  exam_date: string;
  concepts: string[];
  acceleration_factor: number;
  active: boolean;
  created_at: string;
}

export interface ReviewItem {
  id: string;
  concept: string;
  confidence: number;
  interval_days: number;
  next_review: string;
}

export interface QuizSubmitResult {
  is_correct: boolean;
  score: number;
  explanation?: string;
  concept?: string;
}

export interface Course {
  id: string;
  title: string;
  summary: string;
  difficulty_level: string;
  section_count: number;
  created_at: string;
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  content: string;
  order_index: number;
  learning_objectives: string;
  question_prompts: string;
  created_at: string;
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
    const response = await fetch(`${API_URL}/api/prompt-templates`);
    if (!response.ok) throw new Error("获取模板失败");
    const data = (await response.json()) as { templates: PromptTemplates };
    _cachedTemplates = data.templates;
    return _cachedTemplates;
  } catch {
    // 后端不可用时使用默认模板
    return DEFAULT_PROMPT_TEMPLATES;
  }
}

/** 用变量填充模板中的 {{变量}} 占位符 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
