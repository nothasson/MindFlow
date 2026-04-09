export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: Message[];
}

export interface ChatResponse {
  message: Message;
}
