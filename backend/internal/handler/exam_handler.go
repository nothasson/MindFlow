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

// ExamHandler 考试计划 API 处理器
type ExamHandler struct {
	examRepo *repository.ExamRepo
}

// NewExamHandler 创建考试计划处理器
func NewExamHandler(examRepo *repository.ExamRepo) *ExamHandler {
	return &ExamHandler{examRepo: examRepo}
}

// Create POST /api/exam-plans — 创建考试计划
func (h *ExamHandler) Create(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	var req struct {
		Title              string   `json:"title"`
		ExamDate           string   `json:"exam_date"`
		Concepts           []string `json:"concepts"`
		AccelerationFactor float64  `json:"acceleration_factor"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}
	if req.Title == "" || req.ExamDate == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "考试名称和日期不能为空"})
		return
	}
	if req.AccelerationFactor <= 0 {
		req.AccelerationFactor = 1.5
	}
	if req.Concepts == nil {
		req.Concepts = []string{}
	}

	plan, err := h.examRepo.CreateExamPlan(ctx, req.Title, req.ExamDate, req.Concepts, req.AccelerationFactor, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "创建考试计划失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// List GET /api/exam-plans — 列出所有考试计划
func (h *ExamHandler) List(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	plans, err := h.examRepo.ListExamPlans(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "查询考试计划失败: " + err.Error()})
		return
	}
	if plans == nil {
		plans = []model.ExamPlan{}
	}
	c.JSON(http.StatusOK, utils.H{"plans": plans})
}

// Delete DELETE /api/exam-plans/:id — 删除考试计划
func (h *ExamHandler) Delete(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的 ID"})
		return
	}

	if err := h.examRepo.DeleteExamPlan(ctx, id, getUserIDFromCtx(c)); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"ok": true})
}
