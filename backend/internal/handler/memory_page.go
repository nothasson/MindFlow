package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// MemoryPageHandler /memory 页面数据 API
type MemoryPageHandler struct {
	convRepo      *repository.ConversationRepo
	msgRepo       *repository.MessageRepo
	knowledgeRepo *repository.KnowledgeRepo
}

// NewMemoryPageHandler 创建记忆页处理器
func NewMemoryPageHandler(convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo, knowledgeRepo *repository.KnowledgeRepo) *MemoryPageHandler {
	return &MemoryPageHandler{convRepo: convRepo, msgRepo: msgRepo, knowledgeRepo: knowledgeRepo}
}

// RecentConversations GET /api/conversations/recent
func (h *MemoryPageHandler) RecentConversations(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	convs, err := h.convRepo.List(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取对话列表失败"})
		return
	}

	type ConvSummary struct {
		ID          string `json:"id"`
		Title       string `json:"title"`
		LastMessage string `json:"last_message"`
		MessageCount int   `json:"message_count"`
		UpdatedAt   string `json:"updated_at"`
	}

	var result []ConvSummary
	limit := 10
	for i, conv := range convs {
		if i >= limit {
			break
		}
		msgs, _ := h.msgRepo.GetByConversationID(ctx, conv.ID)
		lastMsg := ""
		if len(msgs) > 0 {
			last := msgs[len(msgs)-1]
			lastMsg = last.Content
			if len(lastMsg) > 80 {
				lastMsg = lastMsg[:80] + "..."
			}
		}

		// 相对时间
		ago := time.Since(conv.UpdatedAt)
		var timeStr string
		switch {
		case ago < time.Minute:
			timeStr = "刚刚"
		case ago < time.Hour:
			timeStr = fmt.Sprintf("%d 分钟前", int(ago.Minutes()))
		case ago < 24*time.Hour:
			timeStr = fmt.Sprintf("%d 小时前", int(ago.Hours()))
		default:
			timeStr = fmt.Sprintf("%d 天前", int(ago.Hours()/24))
		}

		result = append(result, ConvSummary{
			ID:           conv.ID.String(),
			Title:        conv.Title,
			LastMessage:  lastMsg,
			MessageCount: len(msgs),
			UpdatedAt:    timeStr,
		})
	}

	if result == nil {
		result = []ConvSummary{}
	}

	c.JSON(http.StatusOK, utils.H{"conversations": result})
}

// KnowledgeRecent GET /api/knowledge/recent
func (h *MemoryPageHandler) KnowledgeRecent(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	nodes, err := h.knowledgeRepo.ListNodes(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取知识点失败"})
		return
	}

	// 统计三档
	newCount := 0
	learningCount := 0
	masteredCount := 0
	for _, n := range nodes {
		switch {
		case n.Confidence >= 0.7:
			masteredCount++
		case n.Confidence >= 0.3:
			learningCount++
		default:
			newCount++
		}
	}

	// 最近 5 个（按 last_reviewed 排序，ListNodes 已按此排序）
	type RecentConcept struct {
		Concept    string  `json:"concept"`
		Confidence float64 `json:"confidence"`
	}
	var recent []RecentConcept
	for i, n := range nodes {
		if i >= 5 {
			break
		}
		recent = append(recent, RecentConcept{
			Concept:    n.Concept,
			Confidence: n.Confidence,
		})
	}
	if recent == nil {
		recent = []RecentConcept{}
	}

	c.JSON(http.StatusOK, utils.H{
		"total":    len(nodes),
		"new":      newCount,
		"learning": learningCount,
		"mastered": masteredCount,
		"recent":   recent,
	})
}

// CalendarStats GET /api/stats/calendar
func (h *MemoryPageHandler) CalendarStats(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)
	days, err := h.msgRepo.CountByDay(ctx, 31, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取日历数据失败"})
		return
	}

	type DayEntry struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}

	var result []DayEntry
	for _, d := range days {
		result = append(result, DayEntry{Date: d.Date, Count: d.Count})
	}
	if result == nil {
		result = []DayEntry{}
	}

	c.JSON(http.StatusOK, utils.H{"days": result})
}
