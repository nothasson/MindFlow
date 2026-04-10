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

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// BriefingHandler 晨间简报 API 处理器
type BriefingHandler struct {
	knowledgeRepo *repository.KnowledgeRepo
	quizRepo      *repository.QuizRepo
	convRepo      *repository.ConversationRepo
	curriculum    *agent.CurriculumAgent
}

// NewBriefingHandler 创建晨间简报处理器
func NewBriefingHandler(
	knowledgeRepo *repository.KnowledgeRepo,
	quizRepo *repository.QuizRepo,
	convRepo *repository.ConversationRepo,
	curriculum *agent.CurriculumAgent,
) *BriefingHandler {
	return &BriefingHandler{
		knowledgeRepo: knowledgeRepo,
		quizRepo:      quizRepo,
		convRepo:      convRepo,
		curriculum:    curriculum,
	}
}

// BriefingItem 简报中的学习项
type BriefingItem struct {
	Concept    string `json:"concept"`
	Reason     string `json:"reason"`
	EstMinutes int    `json:"est_minutes"`
}

// BriefingResponse 晨间简报响应
type BriefingResponse struct {
	Greeting       string        `json:"greeting"`
	ReviewItems    []BriefingItem `json:"review_items"`
	NewItems       []BriefingItem `json:"new_items"`
	QuizSuggestion *BriefingItem  `json:"quiz_suggestion"`
}

// GetBriefing GET /api/daily-briefing — 生成今日学习简报
func (h *BriefingHandler) GetBriefing(ctx context.Context, c *app.RequestContext) {
	genCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	// 聚合学习数据
	var contextParts []string

	// 1. 到期复习项
	dueItems, err := h.knowledgeRepo.GetDueForReview(genCtx)
	if err != nil {
		log.Printf("获取到期复习项失败: %v", err)
	} else if len(dueItems) > 0 {
		var lines []string
		lines = append(lines, "【到期复习项】")
		for _, item := range dueItems {
			lines = append(lines, fmt.Sprintf("- %s（掌握度: %.0f%%，距上次复习: %d 天）",
				item.Concept, item.Confidence*100, int(time.Since(item.LastReviewed).Hours()/24)))
		}
		contextParts = append(contextParts, strings.Join(lines, "\n"))
	} else {
		contextParts = append(contextParts, "【到期复习项】无")
	}

	// 2. 薄弱知识点 Top5
	weakPoints, err := h.knowledgeRepo.GetWeakPoints(genCtx, 5)
	if err != nil {
		log.Printf("获取薄弱知识点失败: %v", err)
	} else if len(weakPoints) > 0 {
		var lines []string
		lines = append(lines, "【薄弱知识点 Top5】")
		for _, item := range weakPoints {
			lines = append(lines, fmt.Sprintf("- %s（掌握度: %.0f%%）", item.Concept, item.Confidence*100))
		}
		contextParts = append(contextParts, strings.Join(lines, "\n"))
	} else {
		contextParts = append(contextParts, "【薄弱知识点】无")
	}

	// 3. 最近错题
	wrongAnswers, err := h.quizRepo.GetWrongAnswers(genCtx)
	if err != nil {
		log.Printf("获取错题列表失败: %v", err)
	} else if len(wrongAnswers) > 0 {
		var lines []string
		lines = append(lines, "【最近错题】")
		limit := len(wrongAnswers)
		if limit > 5 {
			limit = 5
		}
		for _, a := range wrongAnswers[:limit] {
			// 截断题目，避免上下文过长
			q := a.Question
			if len(q) > 80 {
				q = q[:80] + "..."
			}
			lines = append(lines, fmt.Sprintf("- %s（得分: %d/5）", q, a.Score))
		}
		contextParts = append(contextParts, strings.Join(lines, "\n"))
	} else {
		contextParts = append(contextParts, "【最近错题】无")
	}

	// 4. 最近会话数
	convCount, err := h.convRepo.Count(genCtx)
	if err != nil {
		log.Printf("获取会话数失败: %v", err)
	} else {
		contextParts = append(contextParts, fmt.Sprintf("【学习会话总数】%d 次", convCount))
	}

	// 5. 学习天数
	studyDays, err := h.convRepo.CountDistinctDays(genCtx)
	if err != nil {
		log.Printf("获取学习天数失败: %v", err)
	} else {
		contextParts = append(contextParts, fmt.Sprintf("【累计学习天数】%d 天", studyDays))
	}

	// 如果没有任何实质数据，返回默认简报
	hasData := false
	for _, part := range contextParts {
		if !strings.HasSuffix(part, "无") {
			hasData = true
			break
		}
	}
	if !hasData {
		c.JSON(http.StatusOK, utils.H{
			"briefing": BriefingResponse{
				Greeting:    "早上好！你还没有开始学习，上传一份资料开启你的学习之旅吧！",
				ReviewItems: []BriefingItem{},
				NewItems:    []BriefingItem{},
			},
		})
		return
	}

	learningContext := strings.Join(contextParts, "\n\n")

	// 调用 CurriculumAgent 生成简报
	result, err := h.curriculum.GenerateBriefing(genCtx, learningContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "生成简报失败: " + err.Error()})
		return
	}

	// 尝试解析 JSON 响应
	var briefing BriefingResponse
	jsonStr := extractBriefingJSON(result)
	if jsonStr != "" {
		if err := json.Unmarshal([]byte(jsonStr), &briefing); err != nil {
			log.Printf("解析简报 JSON 失败: %v，原始内容: %s", err, result)
			// 降级：返回原始文本作为 greeting
			briefing = BriefingResponse{
				Greeting:    result,
				ReviewItems: []BriefingItem{},
				NewItems:    []BriefingItem{},
			}
		}
	} else {
		briefing = BriefingResponse{
			Greeting:    result,
			ReviewItems: []BriefingItem{},
			NewItems:    []BriefingItem{},
		}
	}

	// 确保数组字段不为 nil（前端友好）
	if briefing.ReviewItems == nil {
		briefing.ReviewItems = []BriefingItem{}
	}
	if briefing.NewItems == nil {
		briefing.NewItems = []BriefingItem{}
	}

	c.JSON(http.StatusOK, utils.H{"briefing": briefing})
}

// extractBriefingJSON 从可能包含前后缀的文本中提取 JSON 对象
func extractBriefingJSON(text string) string {
	start := -1
	depth := 0
	for i, ch := range text {
		if ch == '{' {
			if start == -1 {
				start = i
			}
			depth++
		}
		if ch == '}' {
			depth--
			if depth == 0 && start >= 0 {
				return text[start : i+1]
			}
		}
	}
	return ""
}
