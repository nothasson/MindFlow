package handler

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
	"github.com/hertz-contrib/sse"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/service"
)

// ChatRequest 对话请求
type ChatRequest struct {
	ConversationID string       `json:"conversation_id,omitempty"`
	Messages       []MessageDTO `json:"messages"`
	Stream         bool         `json:"stream,omitempty"`
	Style          string       `json:"style,omitempty"`
	Level          string       `json:"level,omitempty"`
	Concept        string       `json:"concept,omitempty"` // 当前学习的概念（从知识图谱跳转时传入）
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

// ChatAIClient 抽象 AI 微服务能力，用于对话后提取知识点。
type ChatAIClient interface {
	ExtractKnowledgePoints(text string) (*service.ExtractResponse, error)
}

// ChatHandler 对话 HTTP 处理器
type ChatHandler struct {
	orchestrator  *agent.Orchestrator
	convRepo      *repository.ConversationRepo
	msgRepo       *repository.MessageRepo
	knowledgeRepo *repository.KnowledgeRepo
	aiClient      ChatAIClient
}

// NewChatHandler 创建对话处理器
func NewChatHandler(orchestrator *agent.Orchestrator, convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo, knowledgeRepo *repository.KnowledgeRepo, aiClient ChatAIClient) *ChatHandler {
	return &ChatHandler{orchestrator: orchestrator, convRepo: convRepo, msgRepo: msgRepo, knowledgeRepo: knowledgeRepo, aiClient: aiClient}
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
		_ = h.convRepo.TouchUpdatedAt(ctx, id)
		return id, nil
	}

	title := ""
	for _, m := range req.Messages {
		if m.Role == "user" {
			title = m.Content
			runes := []rune(title)
			if len(runes) > 30 {
				title = string(runes[:30])
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
		if _, err := h.msgRepo.Create(ctx, convID, "assistant", reply); err != nil {
			log.Printf("保存 assistant 消息失败: %v", err)
		}
	}

	// 异步从对话内容中提取知识点写入知识图谱
	lastUserMsg := ""
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			lastUserMsg = messages[i].Content
			break
		}
	}
	go h.extractAndSaveKnowledge(lastUserMsg, reply)

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

	if convID != uuid.Nil {
		firstData, _ := json.Marshal(SSEData{ConversationID: convID.String()})
		stream.Publish(&sse.Event{Data: firstData})
	}

	// 用 channel 同步：goroutine 完成后 handler 才返回，避免写入已回收的 response
	done := make(chan struct{})

	go func() {
		defer close(done)
		defer reader.Close()

		var fullContent strings.Builder

		for {
			chunk, recvErr := reader.Recv()
			if recvErr != nil {
				if recvErr == io.EOF {
					// 保存完整的 assistant 消息
					if h.msgRepo != nil && convID != uuid.Nil {
						saveCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
						defer cancel()
						if _, saveErr := h.msgRepo.Create(saveCtx, convID, "assistant", fullContent.String()); saveErr != nil {
							log.Printf("流式保存 assistant 消息失败: %v", saveErr)
						}
					}

					// 记录学习日志
					lastUserMsg := ""
					if len(messages) > 0 {
						for i := len(messages) - 1; i >= 0; i-- {
							if messages[i].Role == "user" {
								lastUserMsg = messages[i].Content
								break
							}
						}
						h.orchestrator.RecordMemory(lastUserMsg, fullContent.String())
					}

					// 异步从对话内容中提取知识点写入知识图谱
					go h.extractAndSaveKnowledge(lastUserMsg, fullContent.String())

					data, _ := json.Marshal(SSEData{Done: true})
					stream.Publish(&sse.Event{Data: data})
					return
				}

				data, _ := json.Marshal(SSEData{Error: "流式读取失败: " + recvErr.Error(), Done: true})
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

	<-done
}

// extractAndSaveKnowledge 异步从对话内容中提取知识点并写入知识图谱。
// 在后台 goroutine 中执行，不阻塞响应。
func (h *ChatHandler) extractAndSaveKnowledge(userMsg, assistantMsg string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("extractAndSaveKnowledge panic: %v", r)
		}
	}()

	if h.aiClient == nil || h.knowledgeRepo == nil {
		return
	}

	// 合并用户问题和 AI 回复作为提取上下文
	text := userMsg + "\n\n" + assistantMsg
	if len([]rune(text)) < 20 {
		return // 内容太短，不提取
	}

	extractResult, err := h.aiClient.ExtractKnowledgePoints(text)
	if err != nil {
		log.Printf("对话知识点提取失败: %v", err)
		return
	}

	points := make([]repository.ExtractedKnowledgePoint, 0, len(extractResult.Points))
	for _, point := range extractResult.Points {
		if point.Concept == "" {
			continue
		}
		points = append(points, repository.ExtractedKnowledgePoint{
			Concept:       point.Concept,
			Description:   point.Description,
			Prerequisites: point.Prerequisites,
		})
	}

	if len(points) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := h.knowledgeRepo.UpsertExtractedPoints(ctx, points); err != nil {
		log.Printf("对话知识点写入知识图谱失败: %v", err)
	} else {
		names := make([]string, len(points))
		for i, p := range points {
			names[i] = p.Concept
		}
		log.Printf("对话知识点已写入知识图谱: %v", names)
	}
}
