export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  stream?: boolean;
}

export interface ChatResponse {
  message: Message;
}

export interface SSEEvent {
  content?: string;
  done?: boolean;
  error?: string;
}
