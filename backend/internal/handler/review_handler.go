package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// ReviewHandler 复习计划 API 处理器
type ReviewHandler struct {
	knowledgeRepo *repository.KnowledgeRepo
}

// NewReviewHandler 创建复习处理器
func NewReviewHandler(knowledgeRepo *repository.KnowledgeRepo) *ReviewHandler {
	return &ReviewHandler{knowledgeRepo: knowledgeRepo}
}

// Due GET /api/review/due — 今日待复习
func (h *ReviewHandler) Due(ctx context.Context, c *app.RequestContext) {
	items, err := h.knowledgeRepo.GetDueForReview(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取复习列表失败: " + err.Error()})
		return
	}
	if items == nil {
		items = []repository.ReviewItem{}
	}
	c.JSON(http.StatusOK, utils.H{"items": items})
}

// Upcoming GET /api/review/upcoming — 即将到期（7 天内）
func (h *ReviewHandler) Upcoming(ctx context.Context, c *app.RequestContext) {
	items, err := h.knowledgeRepo.GetUpcomingReview(ctx, 7)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取即将到期列表失败: " + err.Error()})
		return
	}
	if items == nil {
		items = []repository.ReviewItem{}
	}
	c.JSON(http.StatusOK, utils.H{"items": items})
}
