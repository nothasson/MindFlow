package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/model"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// ConversationHandler 会话 API 处理器
type ConversationHandler struct {
	convRepo *repository.ConversationRepo
	msgRepo  *repository.MessageRepo
}

// NewConversationHandler 创建会话处理器
func NewConversationHandler(convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo) *ConversationHandler {
	return &ConversationHandler{convRepo: convRepo, msgRepo: msgRepo}
}

// Create POST /api/conversations
func (h *ConversationHandler) Create(ctx context.Context, c *app.RequestContext) {
	conv, err := h.convRepo.Create(ctx, "", getUserIDFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "创建会话失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, conv)
}

// List GET /api/conversations
func (h *ConversationHandler) List(ctx context.Context, c *app.RequestContext) {
	convs, err := h.convRepo.List(ctx, getUserIDFromCtx(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取会话列表失败: " + err.Error()})
		return
	}
	if convs == nil {
		convs = []model.Conversation{}
	}
	c.JSON(http.StatusOK, utils.H{"conversations": convs})
}

// GetByID GET /api/conversations/:id
func (h *ConversationHandler) GetByID(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的会话 ID"})
		return
	}

	userID := getUserIDFromCtx(c)
	conv, err := h.convRepo.GetByID(ctx, id, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, utils.H{"error": "会话不存在"})
		return
	}

	msgs, err := h.msgRepo.GetByConversationID(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取消息失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"conversation": conv, "messages": msgs})
}

// Delete DELETE /api/conversations/:id
func (h *ConversationHandler) Delete(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的会话 ID"})
		return
	}

	if err := h.convRepo.Delete(ctx, id, getUserIDFromCtx(c)); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除会话失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"success": true})
}
