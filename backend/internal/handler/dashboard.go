package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// DashboardHandler 仪表盘 API 处理器
type DashboardHandler struct {
	convRepo      *repository.ConversationRepo
	msgRepo       *repository.MessageRepo
	resourceRepo  *repository.ResourceRepo
	courseRepo    *repository.CourseRepo
	knowledgeRepo *repository.KnowledgeRepo
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo, resourceRepo *repository.ResourceRepo, courseRepo *repository.CourseRepo, knowledgeRepo *repository.KnowledgeRepo) *DashboardHandler {
	return &DashboardHandler{
		convRepo:      convRepo,
		msgRepo:       msgRepo,
		resourceRepo:  resourceRepo,
		courseRepo:    courseRepo,
		knowledgeRepo: knowledgeRepo,
	}
}

// Stats GET /api/dashboard/stats
func (h *DashboardHandler) Stats(ctx context.Context, c *app.RequestContext) {
	// 会话数
	// 会话数（单条 SQL）
	totalConversations, err := h.convRepo.Count(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "查询统计失败: " + err.Error()})
		return
	}

	// 消息数（单条 SQL）
	totalMessages, _ := h.msgRepo.CountAll(ctx)

	// 资料数（单条 SQL）
	totalResources, _ := h.resourceRepo.Count(ctx)

	// 课程数（单条 SQL）
	totalCourses, _ := h.courseRepo.Count(ctx)

	// 学习天数（SQL 聚合）
	totalDays, _ := h.convRepo.CountDistinctDays(ctx)

	// 连续学习天数
	today := time.Now()
	activeDays, _ := h.convRepo.GetActiveDays(ctx, 365)
	activeDaySet := map[string]bool{}
	for _, d := range activeDays {
		activeDaySet[d] = true
	}
	streak := 0
	for i := 0; i < 365; i++ {
		day := today.AddDate(0, 0, -i).Format("2006-01-02")
		if activeDaySet[day] {
			streak++
		} else if i > 0 {
			break
		}
	}

	// 薄弱点
	var weakPoints []repository.ReviewItem
	if h.knowledgeRepo != nil {
		weakPoints, _ = h.knowledgeRepo.GetWeakPoints(ctx, 10)
	}
	if weakPoints == nil {
		weakPoints = []repository.ReviewItem{}
	}

	// 学习趋势（最近 7 天每天的消息数，单条 SQL）
	type DayCount struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	trendMap := map[string]int{}
	trendRows, _ := h.msgRepo.CountByDay(ctx, 7)
	for _, r := range trendRows {
		trendMap[r.Date] = r.Count
	}
	var trend []DayCount
	for i := 6; i >= 0; i-- {
		day := today.AddDate(0, 0, -i).Format("2006-01-02")
		trend = append(trend, DayCount{Date: day, Count: trendMap[day]})
	}

	c.JSON(http.StatusOK, utils.H{
		"total_conversations": totalConversations,
		"total_messages":      totalMessages,
		"total_resources":     totalResources,
		"total_courses":       totalCourses,
		"total_days":          totalDays,
		"streak":              streak,
		"weak_points":         weakPoints,
		"trend":               trend,
	})
}

// Heatmap GET /api/dashboard/heatmap
// 返回最近 365 天的学习活跃数据，用于渲染 GitHub 风格热力图
func (h *DashboardHandler) Heatmap(ctx context.Context, c *app.RequestContext) {
	// 复用 msgRepo.CountByDay 查询最近 365 天每日消息数
	days, err := h.msgRepo.CountByDay(ctx, 365)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取热力图数据失败: " + err.Error()})
		return
	}

	type HeatmapEntry struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}

	var heatmap []HeatmapEntry
	for _, d := range days {
		heatmap = append(heatmap, HeatmapEntry{Date: d.Date, Count: d.Count})
	}
	if heatmap == nil {
		heatmap = []HeatmapEntry{}
	}

	c.JSON(http.StatusOK, utils.H{"heatmap": heatmap})
}

// MasteryDistribution GET /api/dashboard/mastery-distribution
// 返回知识点掌握度分布（已掌握/学习中/薄弱 三档）
func (h *DashboardHandler) MasteryDistribution(ctx context.Context, c *app.RequestContext) {
	if h.knowledgeRepo == nil {
		c.JSON(http.StatusOK, utils.H{
			"mastered": 0,
			"learning": 0,
			"weak":     0,
			"total":    0,
		})
		return
	}

	nodes, err := h.knowledgeRepo.ListNodes(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取掌握度分布失败: " + err.Error()})
		return
	}

	// 分类标准：mastered >= 0.8, learning [0.3, 0.8), weak < 0.3
	mastered := 0
	learning := 0
	weak := 0
	for _, n := range nodes {
		switch {
		case n.Confidence >= 0.8:
			mastered++
		case n.Confidence >= 0.3:
			learning++
		default:
			weak++
		}
	}

	c.JSON(http.StatusOK, utils.H{
		"mastered": mastered,
		"learning": learning,
		"weak":     weak,
		"total":    len(nodes),
	})
}
