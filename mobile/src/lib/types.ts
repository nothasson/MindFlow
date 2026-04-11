export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  stream?: boolean;
  conversation_id?: string;
  style?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: Message;
}

export interface SSEEvent {
  conversation_id?: string;
  content?: string;
  done?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeNode {
  id: string;
  concept: string;
  confidence: number;
  error_type?: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  last_reviewed: string;
  next_review: string;
  bloom_level?: string;
  importance?: number;
  description?: string;
}

export interface KnowledgeEdge {
  id: string;
  from: string;
  relation_type: string;
  to: string;
  strength?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface ResourceUploadResult {
  resource_id: string;
  filename: string;
  text: string;
  pages: number;
  chunks: number;
  embedded: boolean;
  status: string;
  source_type: string;
  source_url?: string;
  knowledge_points: string[];
  summary?: string;
  questions?: string[];
  warning?: string;
}

export interface BriefingItem {
  concept: string;
  reason: string;
  est_minutes: number;
}

export interface DailyBriefing {
  greeting: string;
  review_items: BriefingItem[];
  new_items: BriefingItem[];
  quiz_suggestion?: BriefingItem | null;
}

export interface KnowledgeSourceLink {
  id: string;
  concept: string;
  source_type: "resource" | "conversation" | "quiz";
  source_id: string;
  page_or_position: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** Dashboard 统计 */
export interface DashboardWeakPoint {
  concept: string;
  confidence: number;
}

export interface DashboardTrendDay {
  date: string;
  count: number;
}

export interface DashboardStats {
  total_conversations: number;
  total_messages: number;
  total_resources: number;
  total_courses: number;
  total_days: number;
  streak: number;
  weak_points: DashboardWeakPoint[];
  trend: DashboardTrendDay[];
}

export interface HeatmapDay {
  date: string;
  count: number;
}

// ===== 复习系统 =====

export interface ReviewItem {
  id?: string;
  concept: string;
  confidence: number;
  interval_days: number;
  next_review: string;
  easiness_factor: number;
  repetitions: number;
}

// ===== 测验系统 =====

export interface QuizQuestion {
  question: string;
  concept: string;
  difficulty?: string;
}

export interface QuizSubmitResult {
  correct: boolean;
  score: number;
  explanation: string;
  error_type?: string;
}

export interface QuizConversationResponse {
  session_id: string;
  message: string;
  finished: boolean;
  score?: number;
  concepts_assessed?: string[];
}

// ===== 错题本 =====

export type ErrorType =
  | "knowledge_gap"
  | "concept_confusion"
  | "concept_error"
  | "method_error"
  | "calculation_error"
  | "overconfidence"
  | "strategy_error"
  | "unclear_expression";

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  knowledge_gap: "知识盲区",
  concept_confusion: "概念混淆",
  concept_error: "概念错误",
  method_error: "方法错误",
  calculation_error: "计算错误",
  overconfidence: "过度自信",
  strategy_error: "策略错误",
  unclear_expression: "表达不清",
};

export interface WrongBookEntry {
  id: string;
  quiz_attempt_id: string;
  concept: string;
  error_type: ErrorType;
  question: string;
  user_answer: string;
  reviewed: boolean;
  review_count: number;
  next_review?: string;
  created_at: string;
}

export interface WrongBookStats {
  total: number;
  unreviewed: number;
  by_error_type: Record<string, number>;
}

// ===== 设置 =====

export interface LLMProvider {
  name: string;
  model: string;
  active: boolean;
}

export interface LLMProviderSettings {
  active: string;
  providers: LLMProvider[];
}

export interface ExamPlan {
  id: string;
  title: string;
  exam_date: string;
  concepts: string[];
  acceleration_factor: number;
  created_at: string;
}

// ===== 记忆/学习历程 =====

export interface RecentConversation {
  id: string;
  title: string;
  last_message?: string;
  message_count: number;
  updated_at: string;
}

export interface RecentKnowledge {
  total: number;
  new: number;
  learning: number;
  mastered: number;
  recent: {
    concept: string;
    confidence: number;
  }[];
}

export interface CalendarDay {
  date: string;
  count: number;
}

export interface MemorySearchResult {
  source: string;
  content: string;
}

// ===== 资源 =====

export interface Resource {
  id: string;
  filename: string;
  source_type: string;
  source_url?: string;
  status: string;
  pages: number;
  chunks: number;
  knowledge_points: string[];
  summary?: string;
  created_at: string;
}
