import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { sendMessageStream, getConversations, uploadResource } from "./api";

// Mock fetch
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendMessageStream", () => {
    it("正确解析 SSE 事件并调用回调", async () => {
      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();
      const onConversationId = vi.fn();

      // 模拟 SSE 响应流
      const sseData = [
        'data: {"conversation_id":"conv-123"}\n',
        'data: {"content":"你"}\n',
        'data: {"content":"好"}\n',
        'data: {"done":true}\n',
      ].join("\n");

      const encoder = new TextEncoder();
      let readCount = 0;
      const chunks = [encoder.encode(sseData)];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount < chunks.length) {
                return { done: false, value: chunks[readCount++] };
              }
              return { done: true, value: undefined };
            },
            cancel: vi.fn(),
          }),
        },
      });

      await sendMessageStream(
        [{ role: "user", content: "你好" }],
        null,
        onChunk,
        onDone,
        onError,
        onConversationId
      );

      expect(onConversationId).toHaveBeenCalledWith("conv-123");
      expect(onChunk).toHaveBeenCalledWith("你");
      expect(onChunk).toHaveBeenCalledWith("好");
      expect(onDone).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("SSE 错误事件触发 onError", async () => {
      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const sseData = 'data: {"error":"服务器错误"}\n';
      const encoder = new TextEncoder();
      let readCount = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (readCount === 0) {
                readCount++;
                return { done: false, value: encoder.encode(sseData) };
              }
              return { done: true, value: undefined };
            },
            cancel: vi.fn(),
          }),
        },
      });

      await sendMessageStream(
        [{ role: "user", content: "测试" }],
        null,
        onChunk,
        onDone,
        onError
      );

      expect(onError).toHaveBeenCalledWith("服务器错误");
      expect(onDone).not.toHaveBeenCalled();
    });

    it("HTTP 错误时调用 onError", async () => {
      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "内部服务器错误" }),
      });

      await sendMessageStream(
        [{ role: "user", content: "测试" }],
        null,
        onChunk,
        onDone,
        onError
      );

      expect(onError).toHaveBeenCalledWith("内部服务器错误");
      expect(onChunk).not.toHaveBeenCalled();
    });

    it("网络错误时调用 onError", async () => {
      const onChunk = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      await sendMessageStream(
        [{ role: "user", content: "测试" }],
        null,
        onChunk,
        onDone,
        onError
      );

      expect(onError).toHaveBeenCalledWith("Network failure");
    });
  });

  describe("getConversations", () => {
    it("返回会话数组", async () => {
      const conversations = [
        { id: "1", title: "会话1", created_at: "2024-01-01", updated_at: "2024-01-01" },
        { id: "2", title: "会话2", created_at: "2024-01-02", updated_at: "2024-01-02" },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversations }),
      });

      const result = await getConversations();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].title).toBe("会话2");
    });

    it("HTTP 错误时抛出异常", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getConversations()).rejects.toThrow("获取会话列表失败");
    });
  });

  describe("uploadResource", () => {
    it("发送 FormData 并返回结果", async () => {
      const mockResult = {
        resource_id: "res-123",
        filename: "test.pdf",
        text: "文档内容",
        pages: 5,
        chunks: 10,
        embedded: true,
        status: "ready",
        source_type: "file",
        knowledge_points: ["知识点1"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
      const result = await uploadResource(file);

      // 验证 fetch 调用参数
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/resources/upload");
      expect(options.method).toBe("POST");
      expect(options.body).toBeInstanceOf(FormData);
      
      // 验证 FormData 包含文件
      const formData = options.body as FormData;
      expect(formData.get("file")).toBe(file);

      // 验证返回结果
      expect(result.resource_id).toBe("res-123");
      expect(result.filename).toBe("test.pdf");
      expect(result.embedded).toBe(true);
    });

    it("上传失败时抛出正确错误", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({ error: "文件过大" }),
      });

      const file = new File(["big content"], "huge.pdf");

      await expect(uploadResource(file)).rejects.toThrow("文件过大");
    });

    it("网络错误时抛出异常", async () => {
      mockFetch.mockRejectedValueOnce(new Error("网络连接失败"));

      const file = new File(["content"], "test.pdf");

      await expect(uploadResource(file)).rejects.toThrow("网络连接失败");
    });
  });
});
