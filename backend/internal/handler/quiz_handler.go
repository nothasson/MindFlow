package handler

import (
	"context"
	"log"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// QuizHandler 答题 API 处理器
type QuizHandler struct {
	quiz          *agent.QuizAgent
	knowledgeRepo *repository.KnowledgeRepo
	quizRepo      *repository.QuizRepo
}

// NewQuizHandler 创建答题处理器
func NewQuizHandler(quiz *agent.QuizAgent, knowledgeRepo *repository.KnowledgeRepo, quizRepo *repository.QuizRepo) *QuizHandler {
	return &QuizHandler{quiz: quiz, knowledgeRepo: knowledgeRepo, quizRepo: quizRepo}
}

// Generate POST /api/quiz/generate — 给定概念出题
func (h *QuizHandler) Generate(ctx context.Context, c *app.RequestContext) {
	var req struct {
		Concept string `json:"concept"`
	}
	if err := c.BindJSON(&req); err != nil || req.Concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请提供要测验的概念名"})
		return
	}

	messages := []*schema.Message{
		schema.UserMessage("请针对「" + req.Concept + "」这个概念出 3 道题"),
	}

	result, err := h.quiz.GenerateQuiz(ctx, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "出题失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"concept":   req.Concept,
		"questions": result,
	})
}

// Submit POST /api/quiz/submit — 提交答案评分
func (h *QuizHandler) Submit(ctx context.Context, c *app.RequestContext) {
	var req struct {
		Concept  string `json:"concept"`
		Question string `json:"question"`
		Answer   string `json:"answer"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}

	// 简单评分逻辑（后续改为 LLM 判断）
	isCorrect := len(req.Answer) > 10
	score := 3
	if isCorrect {
		score = 4
	}

	// 记录答题
	if h.quizRepo != nil {
		if _, err := h.quizRepo.CreateAttempt(ctx, nil, nil, req.Question, req.Answer, isCorrect, score, ""); err != nil {
			log.Printf("记录答题失败: %v", err)
		}
	}

	// 更新掌握度
	if h.knowledgeRepo != nil && req.Concept != "" {
		if err := h.knowledgeRepo.UpdateMasteryWithSM2(ctx, req.Concept, score); err != nil {
			log.Printf("更新掌握度失败: %v", err)
		}
	}

	c.JSON(http.StatusOK, utils.H{
		"is_correct": isCorrect,
		"score":      score,
		"concept":    req.Concept,
	})
}
