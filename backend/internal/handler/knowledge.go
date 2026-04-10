package handler

import (
	"context"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/knowledge"
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

// PrerequisiteChain GET /api/knowledge/prerequisite-chain?concept=xxx
// 递归追踪薄弱前置知识链
func (h *KnowledgeHandler) PrerequisiteChain(ctx context.Context, c *app.RequestContext) {
	concept := c.Query("concept")
	if concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "缺少 concept 参数"})
		return
	}

	chain, err := h.repo.GetPrerequisiteChain(ctx, concept, 5)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "查询前置知识链失败: " + err.Error()})
		return
	}

	if chain == nil {
		chain = []repository.PrerequisiteChainNode{}
	}

	c.JSON(http.StatusOK, chain)
}

// LearningPath GET /api/knowledge/learning-path
// 基于知识图谱拓扑排序生成学习路径
func (h *KnowledgeHandler) LearningPath(ctx context.Context, c *app.RequestContext) {
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

	// 构造 topo 包所需的输入
	topoNodes := make([]knowledge.Node, len(nodes))
	for i, n := range nodes {
		topoNodes[i] = knowledge.Node{
			Concept:    n.Concept,
			Confidence: n.Confidence,
		}
	}

	topoEdges := make([]knowledge.Edge, 0)
	for _, e := range edges {
		if e.RelationType == "prerequisite" {
			topoEdges = append(topoEdges, knowledge.Edge{
				From: e.FromConcept,
				To:   e.ToConcept,
			})
		}
	}

	// 标记已掌握节点
	mastered := make(map[string]bool)
	for _, n := range nodes {
		if n.Confidence > 0.8 {
			mastered[n.Concept] = true
		}
	}

	path := knowledge.GenerateLearningPath(topoNodes, topoEdges, mastered)
	c.JSON(http.StatusOK, utils.H{"path": path})
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
