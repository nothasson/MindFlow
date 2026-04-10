package handler

import (
	"context"
	"log"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// ReviewHandler 复习计划 API 处理器
type ReviewHandler struct {
	knowledgeRepo *repository.KnowledgeRepo
}

// NewReviewHandler 创建复习处理器
func NewReviewHandler(knowledgeRepo *repository.KnowledgeRepo) *ReviewHandler {
	return &ReviewHandler{knowledgeRepo: knowledgeRepo}
}

// Due GET /api/review/due — 今日待复习（含易混淆概念交错排列）
func (h *ReviewHandler) Due(ctx context.Context, c *app.RequestContext) {
	items, err := h.knowledgeRepo.GetDueForReview(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取复习列表失败: " + err.Error()})
		return
	}
	if items == nil {
		items = []repository.ReviewItem{}
	}

	// 查询相似概念对，对复习列表做交错排序
	if len(items) > 1 {
		similarPairs, pairErr := h.knowledgeRepo.GetSimilarPairs(ctx)
		if pairErr != nil {
			log.Printf("获取相似概念对失败，跳过交错排序: %v", pairErr)
		} else if len(similarPairs) > 0 {
			items = interleaveReviewItems(items, similarPairs)
		}
	}

	c.JSON(http.StatusOK, utils.H{"items": items})
}

// Upcoming GET /api/review/upcoming — 即将到期（7 天内）
func (h *ReviewHandler) Upcoming(ctx context.Context, c *app.RequestContext) {
	items, err := h.knowledgeRepo.GetUpcomingReview(ctx, 7)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取即将到期列表失败: " + err.Error()})
		return
	}
	if items == nil {
		items = []repository.ReviewItem{}
	}
	c.JSON(http.StatusOK, utils.H{"items": items})
}

// interleaveReviewItems 将相似概念交错排列在复习列表中
// 策略：
// 1. 找出列表中存在相似关系的概念对，分组
// 2. 将相似概念对交错排列（A1, B1, A2, B2...）
// 3. 无相似关系的概念穿插在中间
func interleaveReviewItems(items []repository.ReviewItem, similarPairs map[string][]string) []repository.ReviewItem {
	if len(items) <= 1 {
		return items
	}

	// 建立概念名 -> item 的索引
	itemMap := make(map[string]repository.ReviewItem, len(items))
	for _, item := range items {
		itemMap[item.Concept] = item
	}

	// 找出列表中实际存在相似关系的概念组
	// 使用 union-find 简化版：将相似概念聚合为组
	visited := make(map[string]bool)
	var groups [][]repository.ReviewItem // 相似概念组
	var singles []repository.ReviewItem  // 无相似关系的概念

	for _, item := range items {
		if visited[item.Concept] {
			continue
		}

		// 查找该概念在列表中的相似伙伴
		similars := similarPairs[item.Concept]
		var group []repository.ReviewItem
		group = append(group, item)
		visited[item.Concept] = true

		for _, sim := range similars {
			if visited[sim] {
				continue
			}
			if simItem, ok := itemMap[sim]; ok {
				group = append(group, simItem)
				visited[sim] = true
			}
		}

		if len(group) > 1 {
			groups = append(groups, group)
		} else {
			singles = append(singles, item)
		}
	}

	// 如果没有相似组，直接返回原列表
	if len(groups) == 0 {
		return items
	}

	// 交错排列：依次从每个相似组中取一个，然后穿插无关概念
	result := make([]repository.ReviewItem, 0, len(items))
	singleIdx := 0

	// 计算最大组长度
	maxLen := 0
	for _, g := range groups {
		if len(g) > maxLen {
			maxLen = len(g)
		}
	}

	// 逐轮从每个相似组取一个元素，轮次间穿插无关概念
	for round := 0; round < maxLen; round++ {
		for _, g := range groups {
			if round < len(g) {
				result = append(result, g[round])
			}
		}
		// 每轮后穿插一个无关概念（如果还有的话）
		if singleIdx < len(singles) {
			result = append(result, singles[singleIdx])
			singleIdx++
		}
	}

	// 追加剩余的无关概念
	for singleIdx < len(singles) {
		result = append(result, singles[singleIdx])
		singleIdx++
	}

	return result
}
