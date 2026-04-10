package handler

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/review"
)

// QuizHandler 答题 API 处理器
type QuizHandler struct {
	quiz          *agent.QuizAgent
	variantQuiz   *agent.VariantQuizAgent
	knowledgeRepo *repository.KnowledgeRepo
	quizRepo      *repository.QuizRepo
}

// NewQuizHandler 创建答题处理器
func NewQuizHandler(quiz *agent.QuizAgent, variantQuiz *agent.VariantQuizAgent, knowledgeRepo *repository.KnowledgeRepo, quizRepo *repository.QuizRepo) *QuizHandler {
	return &QuizHandler{quiz: quiz, variantQuiz: variantQuiz, knowledgeRepo: knowledgeRepo, quizRepo: quizRepo}
}

// Generate POST /api/quiz/generate — 给定概念出题
// 优先查询学生掌握度，使用 Bloom 认知分类法出题；查不到则降级为普通出题
func (h *QuizHandler) Generate(ctx context.Context, c *app.RequestContext) {
	var req struct {
		Concept string `json:"concept"`
	}
	if err := c.BindJSON(&req); err != nil || req.Concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请提供要测验的概念名"})
		return
	}

	// 加 30 秒超时
	genCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// 尝试查询 confidence，有则使用 Bloom 分层出题
	if h.knowledgeRepo != nil {
		confidence, err := h.knowledgeRepo.GetConceptConfidence(ctx, req.Concept)
		if err == nil {
			result, genErr := h.quiz.GenerateQuizWithBloom(genCtx, req.Concept, confidence)
			if genErr != nil {
				c.JSON(http.StatusInternalServerError, utils.H{"error": "出题失败: " + genErr.Error()})
				return
			}
			bloomLevel, _ := agent.BloomLevel(confidence)
			c.JSON(http.StatusOK, utils.H{
				"concept":     req.Concept,
				"questions":   result,
				"bloom_level": bloomLevel,
				"confidence":  confidence,
			})
			return
		}
		// 查不到 confidence，降级为普通出题
		log.Printf("未找到概念 %q 的掌握度，降级为普通出题: %v", req.Concept, err)
	}

	// 降级：使用原有 GenerateQuiz
	messages := []*schema.Message{
		schema.UserMessage("请针对「" + req.Concept + "」这个概念出 3 道题"),
	}

	result, err := h.quiz.GenerateQuiz(genCtx, messages)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "出题失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"concept":   req.Concept,
		"questions": result,
	})
}

// Submit POST /api/quiz/submit — 提交答案，用 LLM 评分
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

	if req.Answer == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "答案不能为空"})
		return
	}

	// 用 LLM 评判答案质量
	evalCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	score, explanation, err := h.quiz.EvaluateAnswer(evalCtx, req.Question, req.Answer)
	if err != nil {
		log.Printf("LLM 评分失败，使用默认分数: %v", err)
		score = 3
		explanation = ""
	}
	isCorrect := score >= 3

	// 记录答题
	if h.quizRepo != nil {
		attempt, createErr := h.quizRepo.CreateAttempt(ctx, nil, nil, req.Question, req.Answer, isCorrect, score, explanation)
		if createErr != nil {
			log.Printf("记录答题失败: %v", createErr)
		} else if !isCorrect && attempt != nil && req.Concept != "" {
			// 答错自动写入错题本
			errorType := "method_error" // 默认错误类型，后续可由诊断 Agent 细化
			if score <= 1 {
				errorType = "concept_error"
			}
			if wbErr := h.quizRepo.CreateWrongBookEntry(ctx, attempt.ID, req.Concept, errorType); wbErr != nil {
				log.Printf("写入错题本失败: %v", wbErr)
			}
		}
	}

	// 更新遗忘曲线掌握度（FSRS 算法）
	if h.knowledgeRepo != nil && req.Concept != "" {
		rating := review.ScoreToRating(score)
		if err := h.knowledgeRepo.UpdateMasteryWithFSRS(ctx, req.Concept, rating); err != nil {
			log.Printf("更新掌握度失败: %v", err)
		}
	}

	c.JSON(http.StatusOK, utils.H{
		"is_correct":  isCorrect,
		"score":       score,
		"explanation": explanation,
		"concept":     req.Concept,
	})
}

// GenerateVariant POST /api/quiz/variant — 根据错题生成变式题
func (h *QuizHandler) GenerateVariant(ctx context.Context, c *app.RequestContext) {
	var req struct {
		Concept    string `json:"concept"`
		Question   string `json:"question"`
		UserAnswer string `json:"user_answer"`
		ErrorType  string `json:"error_type"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}
	if req.Concept == "" || req.Question == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请提供概念和原题"})
		return
	}
	if req.ErrorType == "" {
		req.ErrorType = "method_error"
	}

	genCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	result, err := h.variantQuiz.Generate(genCtx, req.Concept, req.Question, req.UserAnswer, req.ErrorType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "变式题生成失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"concept": req.Concept,
		"variant": result,
	})
}
