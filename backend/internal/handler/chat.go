package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
	"github.com/hertz-contrib/sse"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// ChatRequest 对话请求
type ChatRequest struct {
	ConversationID string       `json:"conversation_id,omitempty"`
	Messages       []MessageDTO `json:"messages"`
	Stream         bool         `json:"stream,omitempty"`
	Style          string       `json:"style,omitempty"`
	Level          string       `json:"level,omitempty"`
}

// MessageDTO 消息传输对象
type MessageDTO struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse 对话响应（非流式）
type ChatResponse struct {
	ConversationID string     `json:"conversation_id"`
	Message        MessageDTO `json:"message"`
}

// SSEData SSE 事件数据
type SSEData struct {
	ConversationID string `json:"conversation_id,omitempty"`
	Content        string `json:"content,omitempty"`
	Done           bool   `json:"done,omitempty"`
	Error          string `json:"error,omitempty"`
}

// ChatHandler 对话 HTTP 处理器
type ChatHandler struct {
	orchestrator *agent.Orchestrator
	convRepo     *repository.ConversationRepo
	msgRepo      *repository.MessageRepo
}

// NewChatHandler 创建对话处理器
func NewChatHandler(orchestrator *agent.Orchestrator, convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo) *ChatHandler {
	return &ChatHandler{orchestrator: orchestrator, convRepo: convRepo, msgRepo: msgRepo}
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

	// 获取或创建会话（如果配置了数据库）
	var convID uuid.UUID
	if h.convRepo != nil {
		var err error
		convID, err = h.ensureConversation(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, utils.H{"error": "会话管理失败: " + err.Error()})
			return
		}

		// 保存用户消息（最后一条）
		lastMsg := req.Messages[len(req.Messages)-1]
		if lastMsg.Role == "user" && h.msgRepo != nil {
			if _, err := h.msgRepo.Create(ctx, convID, "user", lastMsg.Content); err != nil {
				c.JSON(http.StatusInternalServerError, utils.H{"error": "保存用户消息失败: " + err.Error()})
				return
			}
		}
	}

	messages := make([]*schema.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		messages = append(messages, &schema.Message{
			Role:    schema.RoleType(m.Role),
			Content: m.Content,
		})
	}

	// 应用教学风格和掌握度级别
	if req.Style != "" {
		h.orchestrator.SetTeachingStyle(agent.TeachingStyle(req.Style))
	}
	if req.Level != "" {
		h.orchestrator.SetDifficultyLevel(agent.DifficultyLevel(req.Level))
	}

	if req.Stream {
		h.handleStream(ctx, c, messages, convID)
	} else {
		h.handleNonStream(ctx, c, messages, convID)
	}
}

// ensureConversation 获取或创建会话
func (h *ChatHandler) ensureConversation(ctx context.Context, req ChatRequest) (uuid.UUID, error) {
	if req.ConversationID != "" {
		id, err := uuid.Parse(req.ConversationID)
		if err != nil {
			return uuid.Nil, err
		}
		// 更新 updated_at
		_ = h.convRepo.TouchUpdatedAt(ctx, id)
		return id, nil
	}

	// 从第一条用户消息取标题
	title := ""
	for _, m := range req.Messages {
		if m.Role == "user" {
			title = m.Content
			if len(title) > 30 {
				title = title[:30]
			}
			break
		}
	}

	conv, err := h.convRepo.Create(ctx, title)
	if err != nil {
		return uuid.Nil, err
	}
	return conv.ID, nil
}

// handleNonStream 非流式响应
func (h *ChatHandler) handleNonStream(ctx context.Context, c *app.RequestContext, messages []*schema.Message, convID uuid.UUID) {
	reply, err := h.orchestrator.Chat(ctx, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "AI 服务错误: " + err.Error()})
		return
	}

	// 保存 assistant 消息
	if h.msgRepo != nil && convID != uuid.Nil {
		h.msgRepo.Create(ctx, convID, "assistant", reply)
	}

	c.JSON(http.StatusOK, ChatResponse{
		ConversationID: convID.String(),
		Message: MessageDTO{
			Role:    "assistant",
			Content: reply,
		},
	})
}

// handleStream SSE 流式响应
func (h *ChatHandler) handleStream(ctx context.Context, c *app.RequestContext, messages []*schema.Message, convID uuid.UUID) {
	reader, err := h.orchestrator.ChatStream(ctx, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "AI 服务错误: " + err.Error()})
		return
	}

	stream := sse.NewStream(c)

	// 首条事件包含 conversation_id（如果有）
	if convID != uuid.Nil {
		firstData, _ := json.Marshal(SSEData{ConversationID: convID.String()})
		stream.Publish(&sse.Event{Data: firstData})
	}

	go func() {
		defer reader.Close()

		var fullContent strings.Builder

		for {
			chunk, err := reader.Recv()
			if err != nil {
				if err == io.EOF {
				// 保存完整的 assistant 消息
				if h.msgRepo != nil && convID != uuid.Nil {
					h.msgRepo.Create(context.Background(), convID, "assistant", fullContent.String())
				}

				// 记录学习日志到记忆系统
				if len(messages) > 0 {
					lastUserMsg := ""
					for i := len(messages) - 1; i >= 0; i-- {
						if messages[i].Role == "user" {
							lastUserMsg = messages[i].Content
							break
						}
					}
					h.orchestrator.RecordMemory(lastUserMsg, fullContent.String())
				}

					data, _ := json.Marshal(SSEData{Done: true})
					stream.Publish(&sse.Event{Data: data})
					return
				}
				data, _ := json.Marshal(SSEData{Error: "流式读取失败: " + err.Error(), Done: true})
				stream.Publish(&sse.Event{Data: data})
				return
			}

			if chunk.Content != "" {
				fullContent.WriteString(chunk.Content)
				data, _ := json.Marshal(SSEData{Content: chunk.Content})
				stream.Publish(&sse.Event{Data: data})
			}
		}
	}()

	<-ctx.Done()
}
