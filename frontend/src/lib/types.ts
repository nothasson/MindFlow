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

/** 晨间简报相关类型 */
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

/** 知识点来源关联 */
export interface KnowledgeSourceLink {
  id: string;
  concept: string;
  source_type: "resource" | "conversation" | "quiz";
  source_id: string;
  page_or_position: string;
  created_at: string;
}
