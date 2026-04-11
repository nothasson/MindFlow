import { create } from "zustand";
import type { Conversation, Message } from "../lib/types";
import * as api from "../lib/api";

interface ChatState {
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isStreaming: boolean;
  cancelStream: (() => void) | null;

  /** 加载会话列表 */
  loadConversations: () => Promise<void>;
  /** 选择会话并加载消息 */
  selectConversation: (id: string) => Promise<void>;
  /** 新建对话 */
  newChat: () => void;
  /** 删除会话 */
  deleteConversation: (id: string) => Promise<void>;
  /** 发送消息（流式） */
  sendMessage: (content: string) => Promise<void>;
  /** 停止流式 */
  stopStreaming: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversations: [],
  currentConversationId: null,
  isStreaming: false,
  cancelStream: null,

  loadConversations: async () => {
    try {
      const conversations = await api.getConversations();
      set({ conversations });
    } catch {
      // 静默失败
    }
  },

  selectConversation: async (id) => {
    try {
      const data = await api.getConversation(id);
      set({
        currentConversationId: id,
        messages: data.messages,
      });
    } catch {
      // 静默失败
    }
  },

  newChat: () => {
    const { cancelStream } = get();
    if (cancelStream) cancelStream();
    set({
      messages: [],
      currentConversationId: null,
      isStreaming: false,
      cancelStream: null,
    });
  },

  deleteConversation: async (id) => {
    try {
      await api.deleteConversation(id);
      const { conversations, currentConversationId } = get();
      set({
        conversations: conversations.filter((c) => c.id !== id),
        ...(currentConversationId === id
          ? { messages: [], currentConversationId: null }
          : {}),
      });
    } catch {
      // 静默失败
    }
  },

  sendMessage: async (content) => {
    const { messages, currentConversationId } = get();
    const userMessage: Message = { role: "user", content };
    const assistantMessage: Message = { role: "assistant", content: "" };

    set({
      messages: [...messages, userMessage, assistantMessage],
      isStreaming: true,
    });

    const allMessages = [...messages, userMessage];

    const cancel = await api.sendMessageStream(
      allMessages,
      currentConversationId,
      // onChunk
      (text) => {
        const current = get().messages;
        const last = current[current.length - 1];
        if (last?.role === "assistant") {
          const updated = [...current];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + text,
          };
          set({ messages: updated });
        }
      },
      // onDone
      () => {
        set({ isStreaming: false, cancelStream: null });
        // 刷新会话列表
        get().loadConversations();
      },
      // onError
      (error) => {
        const current = get().messages;
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: last.content || `出错了：${error}`,
          };
        }
        set({ messages: updated, isStreaming: false, cancelStream: null });
      },
      // onConversationId
      (id) => {
        set({ currentConversationId: id });
      }
    );

    set({ cancelStream: cancel });
  },

  stopStreaming: () => {
    const { cancelStream } = get();
    if (cancelStream) {
      cancelStream();
      set({ isStreaming: false, cancelStream: null });
    }
  },
}));
