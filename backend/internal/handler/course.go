package handler

import (
	"context"
	"net/http"
	"regexp"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"
	"log"

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

	userID := getUserIDFromCtx(c)

	// 获取资源（按用户归属校验）
	resource, err := h.resourceRepo.GetByID(ctx, resourceID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, utils.H{"error": "资源不存在"})
		return
	}

	if resource.ContentText == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "资源内容为空，无法生成课程"})
		return
	}

	// 截取前 20000 字符（充分利用资料内容）
	text := resource.ContentText
	if len(text) > 20000 {
		text = text[:20000]
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

	// 保存课程（关联 userID）
	course, err := h.courseRepo.Create(ctx, &resourceID, resource.Title, outline, req.Difficulty, "socratic", userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "保存课程失败: " + err.Error()})
		return
	}

	// 解析大纲中的章节并写入 course_sections
	sections := parseOutlineSections(outline)
	for i, sec := range sections {
		_, err := h.courseRepo.CreateSection(ctx, course.ID, sec.Title, sec.Summary, sec.Content, i+1, sec.Objectives, sec.Questions, userID)
		if err != nil {
			log.Printf("章节创建失败 (course=%s, section=%d): %v", course.ID, i+1, err)
		}
	}
	if len(sections) > 0 {
		if err := h.courseRepo.UpdateSectionCount(ctx, course.ID, len(sections)); err != nil {
			log.Printf("更新章节数失败 (course=%s): %v", course.ID, err)
		}
		course.SectionCount = len(sections)
	}

	c.JSON(http.StatusOK, utils.H{
		"course":  course,
		"outline": outline,
	})
}

// List GET /api/courses
func (h *CourseHandler) List(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	courses, err := h.courseRepo.List(ctx, userID)
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

	userID := getUserIDFromCtx(c)
	course, err := h.courseRepo.GetByID(ctx, id, userID)
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

// outlineSection 大纲章节解析结果
type outlineSection struct {
	Title      string
	Summary    string
	Content    string
	Objectives string
	Questions  string
}

// parseOutlineSections 解析 LLM 生成的 Markdown 课程大纲，提取章节信息
func parseOutlineSections(outline string) []outlineSection {
	var sections []outlineSection

	// 按 ### 标题分割章节
	chapterRe := regexp.MustCompile(`(?m)^###\s+第\s*\d+\s*章[：:]\s*(.+)$`)
	chapterIndices := chapterRe.FindAllStringSubmatchIndex(outline, -1)

	for i, idx := range chapterIndices {
		start := idx[0]
		end := len(outline)
		if i+1 < len(chapterIndices) {
			end = chapterIndices[i+1][0]
		}

		chapterText := outline[start:end]
		title := strings.TrimSpace(outline[idx[2]:idx[3]])

		// 提取摘要
		summary := extractField(chapterText, `\*\*摘要\*\*[：:]?\s*`)

		// 提取教学内容
		content := extractMultilineField(chapterText, `\*\*教学内容\*\*[：:]?`)

		// 提取学习目标
		objectives := extractListField(chapterText, `\*\*学习目标\*\*[：:]?`)

		// 提取关键问题
		questions := extractListField(chapterText, `\*\*关键问题\*\*[：:]?`)

		sections = append(sections, outlineSection{
			Title:      title,
			Summary:    summary,
			Content:    content,
			Objectives: objectives,
			Questions:  questions,
		})
	}

	return sections
}

// extractField 提取 Markdown 中某标签后的文本内容
func extractField(text, pattern string) string {
	re := regexp.MustCompile(pattern + `(.+?)(?:\n\n|\n---|\n###|$)`)
	match := re.FindStringSubmatch(text)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

// extractListField 提取 Markdown 中某标签后的列表项
func extractListField(text, pattern string) string {
	re := regexp.MustCompile(pattern + `\s*((?:-\s+.+\n?)+)`)
	match := re.FindStringSubmatch(text)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

// extractMultilineField 提取 Markdown 中某标签后的多行内容（到下一个 **标签** 或 --- 为止）
func extractMultilineField(text, pattern string) string {
	re := regexp.MustCompile(`(?s)` + pattern + `\s*\n(.*?)(?:\n\*\*[^*]+\*\*[：:]|\n---|\n###|$)`)
	match := re.FindStringSubmatch(text)
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}
	return ""
}

// Delete DELETE /api/courses/:id
func (h *CourseHandler) Delete(ctx context.Context, c *app.RequestContext) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "无效的课程 ID"})
		return
	}

	userID := getUserIDFromCtx(c)
	if err := h.courseRepo.Delete(ctx, id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除课程失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"success": true})
}
