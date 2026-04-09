export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  stream?: boolean;
  conversation_id?: string;
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
