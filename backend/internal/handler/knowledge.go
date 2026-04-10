package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/repository"
)

// KnowledgeHandler 知识图谱处理器
type KnowledgeHandler struct {
	repo *repository.KnowledgeRepo
}

// NewKnowledgeHandler 创建知识图谱处理器
func NewKnowledgeHandler(repo *repository.KnowledgeRepo) *KnowledgeHandler {
	return &KnowledgeHandler{repo: repo}
}

// Graph GET /api/knowledge/graph
// 返回知识图谱的节点和边
func (h *KnowledgeHandler) Graph(ctx context.Context, c *app.RequestContext) {
	nodes, err := h.repo.ListNodes(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取知识点失败: " + err.Error()})
		return
	}

	edges, err := h.repo.ListEdges(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取知识关系失败: " + err.Error()})
		return
	}

	if nodes == nil {
		nodes = []repository.KnowledgeNode{}
	}
	if edges == nil {
		edges = []repository.KnowledgeEdge{}
	}

	c.JSON(http.StatusOK, utils.H{
		"nodes": nodes,
		"edges": edges,
	})
}

// DeleteConcept DELETE /api/knowledge/concept/:name — 删除知识点
func (h *KnowledgeHandler) DeleteConcept(ctx context.Context, c *app.RequestContext) {
	concept := c.Param("name")
	if concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "概念名不能为空"})
		return
	}

	if err := h.repo.DeleteByConcept(ctx, concept); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"success": true})
}
