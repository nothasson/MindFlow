package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/agent"
)

// ChatRequest 对话请求
type ChatRequest struct {
	Messages []MessageDTO `json:"messages"`
}

// MessageDTO 消息传输对象
type MessageDTO struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse 对话响应
type ChatResponse struct {
	Message MessageDTO `json:"message"`
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

	// 调用 Tutor Agent
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
