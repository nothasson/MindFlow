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
