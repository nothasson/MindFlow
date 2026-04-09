package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/agent"
)

// ChatRequest 对话请求
type ChatRequest struct {
	Messages []MessageDTO `json:"messages"`
	Stream   bool         `json:"stream,omitempty"`
}

// MessageDTO 消息传输对象
type MessageDTO struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse 对话响应（非流式）
type ChatResponse struct {
	Message MessageDTO `json:"message"`
}

// SSEEvent SSE 事件数据
type SSEEvent struct {
	Content string `json:"content,omitempty"`
	Done    bool   `json:"done,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ChatHandler 对话 HTTP 处理器
type ChatHandler struct {
	tutor *agent.TutorAgent
}

// NewChatHandler 创建对话处理器
func NewChatHandler(tutor *agent.TutorAgent) *ChatHandler {
	return &ChatHandler{tutor: tutor}
}

// Handle POST /api/chat
func (h *ChatHandler) Handle(ctx context.Context, c *app.RequestContext) {
	var req ChatRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, utils.H{"error": "消息不能为空"})
		return
	}

	// 转换 DTO 到 schema.Message
	messages := make([]*schema.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		messages = append(messages, &schema.Message{
			Role:    schema.RoleType(m.Role),
			Content: m.Content,
		})
	}

	if req.Stream {
		h.handleStream(ctx, c, messages)
	} else {
		h.handleNonStream(ctx, c, messages)
	}
}

// handleNonStream 非流式响应（保持兼容）
func (h *ChatHandler) handleNonStream(ctx context.Context, c *app.RequestContext, messages []*schema.Message) {
	reply, err := h.tutor.Chat(ctx, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "AI 服务错误: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, ChatResponse{
		Message: MessageDTO{
			Role:    "assistant",
			Content: reply,
		},
	})
}

// handleStream SSE 流式响应
func (h *ChatHandler) handleStream(ctx context.Context, c *app.RequestContext, messages []*schema.Message) {
	// 设置 SSE 响应头
	c.SetStatusCode(http.StatusOK)
	c.Response.Header.Set("Content-Type", "text/event-stream")
	c.Response.Header.Set("Cache-Control", "no-cache")
	c.Response.Header.Set("Connection", "keep-alive")
	c.Response.Header.Set("X-Accel-Buffering", "no")

	reader, err := h.tutor.ChatStream(ctx, messages)
	if err != nil {
		writeSSE(c, SSEEvent{Error: "AI 服务错误: " + err.Error(), Done: true})
		return
	}
	defer reader.Close()

	for {
		chunk, err := reader.Recv()
		if err != nil {
			if err == io.EOF {
				writeSSE(c, SSEEvent{Done: true})
				return
			}
			writeSSE(c, SSEEvent{Error: "流式读取失败: " + err.Error(), Done: true})
			return
		}

		if chunk.Content != "" {
			writeSSE(c, SSEEvent{Content: chunk.Content})
		}
	}
}

// writeSSE 写入一条 SSE 事件并 flush
func writeSSE(c *app.RequestContext, event SSEEvent) {
	data, _ := json.Marshal(event)
	c.Write([]byte(fmt.Sprintf("data: %s\n\n", data)))
	c.Flush()
}
