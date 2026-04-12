package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/review"
)

// QuizHandler 答题 API 处理器
type QuizHandler struct {
	quiz             *agent.QuizAgent
	variantQuiz      *agent.VariantQuizAgent
	knowledgeRepo    *repository.KnowledgeRepo
	quizRepo         *repository.QuizRepo
	sourceLinkRepo   *repository.SourceLinkRepo // 来源关联（可选）
}

// NewQuizHandler 创建答题处理器
func NewQuizHandler(quiz *agent.QuizAgent, variantQuiz *agent.VariantQuizAgent, knowledgeRepo *repository.KnowledgeRepo, quizRepo *repository.QuizRepo) *QuizHandler {
	return &QuizHandler{quiz: quiz, variantQuiz: variantQuiz, knowledgeRepo: knowledgeRepo, quizRepo: quizRepo}
}

// SetSourceLinkRepo 注入来源关联仓库（可选）。
func (h *QuizHandler) SetSourceLinkRepo(repo *repository.SourceLinkRepo) {
	h.sourceLinkRepo = repo
}

// Generate POST /api/quiz/generate — 给定概念出题
// 优先查询学生掌握度，使用 Bloom 认知分类法出题；查不到则降级为普通出题
func (h *QuizHandler) Generate(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	_ = userID // Generate 当前无需传 userID 到 repo，预留
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
		confidence, err := h.knowledgeRepo.GetConceptConfidence(ctx, req.Concept, userID)
		if err == nil {
			result, genErr := h.quiz.GenerateQuizWithBloom(genCtx, req.Concept, confidence)
			if genErr != nil {
				c.JSON(http.StatusInternalServerError, utils.H{"error": "出题失败: " + genErr.Error()})
				return
			}
			bloomLevel, _ := agent.BloomLevel(confidence)

			// 解析 LLM 返回的 JSON 数组
			questions := parseQuizJSON(result, req.Concept)

			c.JSON(http.StatusOK, utils.H{
				"concept":     req.Concept,
				"questions":   questions,
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

	questions := parseQuizJSON(result, req.Concept)

	c.JSON(http.StatusOK, utils.H{
		"concept":   req.Concept,
		"questions": questions,
	})
}

// Submit POST /api/quiz/submit — 提交答案，用 LLM 评分
func (h *QuizHandler) Submit(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
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
		attempt, createErr := h.quizRepo.CreateAttempt(ctx, nil, nil, req.Question, req.Answer, isCorrect, score, explanation, userID)
		if createErr != nil {
			log.Printf("记录答题失败: %v", createErr)
		} else if attempt != nil {
			// 写入来源关联：将知识点与测验记录关联
			if h.sourceLinkRepo != nil && req.Concept != "" {
				if linkErr := h.sourceLinkRepo.CreateLink(ctx, req.Concept, "quiz", attempt.ID, "", userID); linkErr != nil {
					log.Printf("写入来源关联失败 (concept=%s, quiz=%s): %v", req.Concept, attempt.ID, linkErr)
				}
			}

			if !isCorrect && req.Concept != "" {
				// 答错自动写入错题本
				errorType := "method_error" // 默认错误类型，后续可由诊断 Agent 细化
				if score <= 1 {
					errorType = "concept_error"
				}
				if wbErr := h.quizRepo.CreateWrongBookEntry(ctx, attempt.ID, req.Concept, errorType, userID); wbErr != nil {
					log.Printf("写入错题本失败: %v", wbErr)
				}
			}
		}
	}

	// 更新遗忘曲线掌握度（FSRS 算法）
	if h.knowledgeRepo != nil && req.Concept != "" {
		rating := review.ScoreToRating(score)
		if userID == nil || *userID == uuid.Nil {
			log.Printf("Submit: 无法更新掌握度，缺少有效 userID")
		} else if err := h.knowledgeRepo.UpdateMasteryWithFSRS(ctx, req.Concept, rating, *userID); err != nil {
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
	userID := getUserIDFromCtx(c)
	_ = userID // 预留
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

// ConversationalQuiz POST /api/quiz/conversation — 对话式考察
func (h *QuizHandler) ConversationalQuiz(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	_ = userID // 预留
	var req struct {
		Concept string `json:"concept"`
		Message string `json:"message"`
		Round   int    `json:"round"`
		History string `json:"history"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}
	if req.Concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请提供考察概念"})
		return
	}
	if req.Round <= 0 {
		req.Round = 1
	}

	// 把当前消息追加到历史（第一轮 message 可能为空，跳过）
	fullHistory := req.History
	if req.Message != "" {
		if fullHistory != "" {
			fullHistory += "\n"
		}
		fullHistory += fmt.Sprintf("学生（第%d轮）：%s", req.Round, req.Message)
	}

	genCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	result, err := h.quiz.GenerateConversationalQuiz(genCtx, req.Concept, req.Round, fullHistory)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "对话考察失败: " + err.Error()})
		return
	}

	// 更新历史
	fullHistory += fmt.Sprintf("\n导师（第%d轮）：%s", req.Round, result)

	// 检测 AI 是否决定结束考察（通过 [考察完成] 标记）
	finished := strings.Contains(result, "[考察完成]") || strings.Contains(result, "【考察完成】")

	// 对话考察完成时，从 AI 回复中提取评分并更新掌握度
	var finalScore int
	if finished && h.knowledgeRepo != nil {
		// 尝试提取 1-5 分的评分
		for _, ch := range result {
			if ch >= '1' && ch <= '5' {
				finalScore = int(ch - '0')
				break
			}
		}
		if finalScore > 0 {
			rating := review.ScoreToRating(finalScore)
			if userID == nil || *userID == uuid.Nil {
				log.Printf("ConversationalQuiz: 无法更新掌握度，缺少有效 userID")
			} else if err := h.knowledgeRepo.UpdateMasteryWithFSRS(ctx, req.Concept, rating, *userID); err != nil {
				log.Printf("对话考察更新掌握度失败: %v", err)
			}
		}
	}

	c.JSON(http.StatusOK, utils.H{
		"reply":    result,
		"round":    req.Round + 1,
		"history":  fullHistory,
		"finished": finished,
		"score":    finalScore,
	})
}

// AnkiRate POST /api/quiz/anki-rate — Anki 卡片评分，直接更新 FSRS 掌握度
func (h *QuizHandler) AnkiRate(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	_ = userID // 预留
	var req struct {
		Concept string `json:"concept"`
		Rating  int    `json:"rating"` // 1=Again, 2=Hard, 3=Good, 4=Easy
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误"})
		return
	}
	if req.Concept == "" || req.Rating < 1 || req.Rating > 4 {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请提供概念和有效评分（1-4）"})
		return
	}

	if h.knowledgeRepo != nil {
		// FSRS Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
		if userID == nil || *userID == uuid.Nil {
			log.Printf("AnkiRate: 无法更新掌握度，缺少有效 userID")
		} else if err := h.knowledgeRepo.UpdateMasteryWithFSRS(ctx, req.Concept, review.Rating(req.Rating), *userID); err != nil {
			log.Printf("Anki 评分更新掌握度失败: %v", err)
			c.JSON(http.StatusInternalServerError, utils.H{"error": "更新失败"})
			return
		}
	}

	c.JSON(http.StatusOK, utils.H{"ok": true, "concept": req.Concept, "rating": req.Rating})
}

// quizQuestionItem 结构化题目
type quizQuestionItem struct {
	Question string `json:"question"`
	Hint     string `json:"hint"`
	Concept  string `json:"concept"`
}

// parseQuizJSON 解析 LLM 返回的 JSON 数组，提取题目列表
// 如果 JSON 解析失败，将整段文本作为一道题返回
func parseQuizJSON(raw string, concept string) []quizQuestionItem {
	// 找到 JSON 数组部分（兼容 LLM 可能加 ```json 包裹）
	text := strings.TrimSpace(raw)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	// 找第一个 [ 和最后一个 ]
	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start >= 0 && end > start {
		text = text[start : end+1]
	}

	var items []quizQuestionItem
	if err := json.Unmarshal([]byte(text), &items); err == nil {
		// 补充 concept
		for i := range items {
			items[i].Concept = concept
		}
		return items
	}

	// JSON 解析失败，整段作为一道题
	if raw != "" {
		return []quizQuestionItem{{Question: raw, Concept: concept}}
	}
	return nil
}
