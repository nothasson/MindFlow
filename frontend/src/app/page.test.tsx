import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Home from "./page";

// Mock useChat hook
const mockUseChat = vi.fn();
vi.mock("@/hooks/useChat", () => ({
  useChat: () => mockUseChat(),
}));

describe("首页状态切分", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("空态（无消息）", () => {
    beforeEach(() => {
      mockUseChat.mockReturnValue({
        messages: [],
        isLoading: false,
        error: null,
        sendMessage: vi.fn(),
      });
    });

    it("应显示品牌标题 MindFlow", () => {
      render(<Home />);
      expect(screen.getByRole("heading", { name: /mindflow/i })).toBeInTheDocument();
    });

    it("应显示品牌图标", () => {
      render(<Home />);
      expect(screen.getByText("✺")).toBeInTheDocument();
    });

    it("应显示单个输入框", () => {
      render(<Home />);
      const textareas = screen.getAllByRole("textbox");
      expect(textareas).toHaveLength(1);
    });

    it("不应显示消息列表", () => {
      render(<Home />);
      // MessageList 中的思考中指示器不应存在
      expect(screen.queryByText("思考中...")).not.toBeInTheDocument();
    });
  });

  describe("会话态（有消息）", () => {
    beforeEach(() => {
      mockUseChat.mockReturnValue({
        messages: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好！有什么我可以帮助你的吗？" },
        ],
        isLoading: false,
        error: null,
        sendMessage: vi.fn(),
      });
    });

    it("不应显示品牌标题", () => {
      render(<Home />);
      expect(screen.queryByRole("heading", { name: /mindflow/i })).not.toBeInTheDocument();
    });

    it("应显示消息内容", () => {
      render(<Home />);
      expect(screen.getByText("你好")).toBeInTheDocument();
      expect(screen.getByText("你好！有什么我可以帮助你的吗？")).toBeInTheDocument();
    });

    it("应显示底部输入框", () => {
      render(<Home />);
      const textareas = screen.getAllByRole("textbox");
      expect(textareas).toHaveLength(1);
    });
  });
});

// 单独测试 useChat 初始状态（不使用 mock）
describe("useChat hook", () => {
  it("初始消息应为空数组", async () => {
    // 取消 mock 重新导入真实模块
    vi.doUnmock("@/hooks/useChat");
    const { useChat: realUseChat } = await import("@/hooks/useChat");
    
    const { result } = renderHook(() => realUseChat());
    expect(result.current.messages).toEqual([]);
  });
});
