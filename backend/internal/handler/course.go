package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/model"
	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// CourseHandler 课程 API 处理器
type CourseHandler struct {
	courseRepo   *repository.CourseRepo
	resourceRepo *repository.ResourceRepo
	courseware   *agent.CoursewareAgent
}

// NewCourseHandler 创建课程处理器
func NewCourseHandler(courseRepo *repository.CourseRepo, resourceRepo *repository.ResourceRepo, courseware *agent.CoursewareAgent) *CourseHandler {
	return &CourseHandler{
		courseRepo:   courseRepo,
		resourceRepo: resourceRepo,
		courseware:   courseware,
	}
}

// GenerateFromResource POST /api/resources/:id/generate-course
func (h *CourseHandler) GenerateFromResource(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	resourceID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的资源 ID"})
		return
	}

	// 获取资源
	resource, err := h.resourceRepo.GetByID(ctx, resourceID)
	if err != nil {
		c.JSON(http.StatusNotFound, utils.H{"error": "资源不存在"})
		return
	}

	if resource.ContentText == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "资源内容为空，无法生成课程"})
		return
	}

	// 截取前 8000 字符避免 token 超限
	text := resource.ContentText
	if len(text) > 8000 {
		text = text[:8000]
	}

	// 生成课程
	var req struct {
		Difficulty string `json:"difficulty"`
	}
	_ = c.BindJSON(&req) // 允许无 body（使用默认值）
	if req.Difficulty == "" {
		req.Difficulty = "beginner"
	}

	outline, err := h.courseware.GenerateCourse(ctx, text, req.Difficulty)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "课程生成失败: " + err.Error()})
		return
	}

	// 保存课程
	course, err := h.courseRepo.Create(ctx, &resourceID, resource.Title, outline, req.Difficulty, "socratic")
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "保存课程失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"course":  course,
		"outline": outline,
	})
}

// List GET /api/courses
func (h *CourseHandler) List(ctx context.Context, c *app.RequestContext) {
	courses, err := h.courseRepo.List(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取课程列表失败: " + err.Error()})
		return
	}
	if courses == nil {
		courses = []model.Course{}
	}
	c.JSON(http.StatusOK, utils.H{"courses": courses})
}

// GetByID GET /api/courses/:id
func (h *CourseHandler) GetByID(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的课程 ID"})
		return
	}

	course, err := h.courseRepo.GetByID(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, utils.H{"error": "课程不存在"})
		return
	}

	sections, err := h.courseRepo.GetSections(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取章节失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"course":   course,
		"sections": sections,
	})
}

// Delete DELETE /api/courses/:id
func (h *CourseHandler) Delete(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的课程 ID"})
		return
	}

	if err := h.courseRepo.Delete(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除课程失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"success": true})
}
