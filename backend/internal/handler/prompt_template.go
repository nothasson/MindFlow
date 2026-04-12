package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
)

// PromptTemplates 各场景的 prompt 模板，使用 {{变量}} 占位符
// 前端/移动端通过此 API 获取统一模板，避免硬编码
var PromptTemplates = map[string]string{
	// 基于资料学习
	"learn_resource": "我想基于资料「{{filename}}」开始学习，请先帮我梳理重点知识点。",
	// 基于刚上传的资料学习（无具体文件名时）
	"learn_resource_default": "我想基于刚上传的资料开始学习，请先帮我梳理重点知识点。",
	// 学习知识点
	"learn_concept": "我想学习知识点「{{concept}}」，请帮我深入理解这个概念。",
	// 学习课程章节
	"learn_course_section": "我想学习课程「{{course_title}}」的第 {{section_index}} 章「{{section_title}}」。\n\n学习目标：\n{{learning_objectives}}\n\n请用苏格拉底式对话引导我理解这些内容。",
	// 学习课程（移动端简化版）
	"learn_course": "我想学习课程「{{course_title}}」，请帮我梳理重点知识点。",
	// 学习课程（默认无课程名）
	"learn_course_default": "我想开始课程学习",
	// 复习知识点
	"review_concept": "复习一下「{{concept}}」",
	// 学习新知识点（简报中）
	"learn_new_concept": "我想学习「{{concept}}」",
	// 出题测验
	"quiz_concept": "请针对「{{concept}}」出一道测试题",
}

// HandleGetPromptTemplates GET /api/prompt-templates — 返回所有 prompt 模板
func HandleGetPromptTemplates(ctx context.Context, c *app.RequestContext) {
	c.JSON(http.StatusOK, utils.H{
		"templates": PromptTemplates,
	})
}
