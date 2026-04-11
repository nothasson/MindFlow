package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// EvaluationHandler LLM 评估 API 处理器
type EvaluationHandler struct {
	evalRepo *repository.EvaluationRepo
}

// NewEvaluationHandler 创建评估处理器
func NewEvaluationHandler(evalRepo *repository.EvaluationRepo) *EvaluationHandler {
	return &EvaluationHandler{evalRepo: evalRepo}
}

// Stats GET /api/evaluations/stats — 返回各类型评估的统计
func (h *EvaluationHandler) Stats(ctx context.Context, c *app.RequestContext) {
	// 如果指定了 eval_type，只返回该类型的统计
	evalType := c.Query("eval_type")
	if evalType != "" {
		stats, err := h.evalRepo.GetEvaluationStats(ctx, evalType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, utils.H{"error": "获取评估统计失败: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, stats)
		return
	}

	// 返回所有类型的统计
	stats, err := h.evalRepo.GetAllStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取评估统计失败: " + err.Error()})
		return
	}
	if stats == nil {
		stats = []repository.EvaluationStats{}
	}
	c.JSON(http.StatusOK, utils.H{"stats": stats})
}

// CreateRequest 手动提交评估的请求体
type CreateEvaluationRequest struct {
	EvalType       string                 `json:"eval_type"`
	ConversationID string                 `json:"conversation_id,omitempty"`
	Score          float64                `json:"score"`
	Details        map[string]interface{} `json:"details,omitempty"`
}

// Create POST /api/evaluations — 手动提交评估（用于调试）
func (h *EvaluationHandler) Create(ctx context.Context, c *app.RequestContext) {
	var req CreateEvaluationRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误: " + err.Error()})
		return
	}

	if req.EvalType == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "eval_type 不能为空"})
		return
	}
	if req.Score < 0 || req.Score > 1 {
		c.JSON(http.StatusBadRequest, utils.H{"error": "score 必须在 0.0 - 1.0 之间"})
		return
	}

	var convID *uuid.UUID
	if req.ConversationID != "" {
		id, err := uuid.Parse(req.ConversationID)
		if err != nil {
			c.JSON(http.StatusBadRequest, utils.H{"error": "无效的 conversation_id"})
			return
		}
		convID = &id
	}

	if req.Details == nil {
		req.Details = map[string]interface{}{}
	}

	if err := h.evalRepo.CreateEvaluation(ctx, req.EvalType, convID, req.Score, req.Details); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "保存评估失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"ok": true})
}
