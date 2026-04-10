package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// WrongBookHandler 错题本 API 处理器
type WrongBookHandler struct {
	quizRepo *repository.QuizRepo
}

// NewWrongBookHandler 创建错题本处理器
func NewWrongBookHandler(quizRepo *repository.QuizRepo) *WrongBookHandler {
	return &WrongBookHandler{quizRepo: quizRepo}
}

// List GET /api/wrongbook — 错题列表
func (h *WrongBookHandler) List(ctx context.Context, c *app.RequestContext) {
	entries, err := h.quizRepo.ListWrongBook(ctx, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取错题本失败: " + err.Error()})
		return
	}
	if entries == nil {
		c.JSON(http.StatusOK, utils.H{"entries": []struct{}{}})
		return
	}
	c.JSON(http.StatusOK, utils.H{"entries": entries})
}

// Stats GET /api/wrongbook/stats — 按错误类型分组统计
func (h *WrongBookHandler) Stats(ctx context.Context, c *app.RequestContext) {
	stats, err := h.quizRepo.GetWrongBookStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取错题统计失败: " + err.Error()})
		return
	}
	if stats == nil {
		stats = []repository.WrongBookStats{}
	}
	c.JSON(http.StatusOK, utils.H{"stats": stats})
}

// MarkReviewed POST /api/wrongbook/:id/review — 标记已复习
func (h *WrongBookHandler) MarkReviewed(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的 ID"})
		return
	}

	if err := h.quizRepo.MarkWrongBookReviewed(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "标记失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, utils.H{"ok": true})
}

// Delete DELETE /api/wrongbook/:id — 删除错题
func (h *WrongBookHandler) Delete(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的 ID"})
		return
	}

	if err := h.quizRepo.DeleteWrongBookEntry(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, utils.H{"ok": true})
}
