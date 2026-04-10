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
	convRepo     *repository.ConversationRepo
	msgRepo      *repository.MessageRepo
	resourceRepo *repository.ResourceRepo
	courseRepo   *repository.CourseRepo
}

// NewDashboardHandler 创建仪表盘处理器
func NewDashboardHandler(convRepo *repository.ConversationRepo, msgRepo *repository.MessageRepo, resourceRepo *repository.ResourceRepo, courseRepo *repository.CourseRepo) *DashboardHandler {
	return &DashboardHandler{
		convRepo:     convRepo,
		msgRepo:      msgRepo,
		resourceRepo: resourceRepo,
		courseRepo:   courseRepo,
	}
}

// Stats GET /api/dashboard/stats
func (h *DashboardHandler) Stats(ctx context.Context, c *app.RequestContext) {
	// 会话数
	convs, _ := h.convRepo.List(ctx)
	totalConversations := len(convs)

	// 消息数
	totalMessages := 0
	for _, conv := range convs {
		msgs, _ := h.msgRepo.GetByConversationID(ctx, conv.ID)
		totalMessages += len(msgs)
	}

	// 资料数
	resources, _ := h.resourceRepo.List(ctx)
	totalResources := len(resources)

	// 课程数
	courses, _ := h.courseRepo.List(ctx)
	totalCourses := len(courses)

	// 计算学习天数（有会话的不同日期数）
	daySet := map[string]bool{}
	for _, conv := range convs {
		day := conv.CreatedAt.Format("2006-01-02")
		daySet[day] = true
	}
	totalDays := len(daySet)

	// 连续学习天数（从今天往回数）
	streak := 0
	today := time.Now()
	for i := 0; i < 365; i++ {
		day := today.AddDate(0, 0, -i).Format("2006-01-02")
		if daySet[day] {
			streak++
		} else if i > 0 {
			break
		}
	}

	c.JSON(http.StatusOK, utils.H{
		"total_conversations": totalConversations,
		"total_messages":      totalMessages,
		"total_resources":     totalResources,
		"total_courses":       totalCourses,
		"total_days":          totalDays,
		"streak":              streak,
	})
}
