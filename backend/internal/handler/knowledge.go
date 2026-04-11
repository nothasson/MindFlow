package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/knowledge"
	"github.com/nothasson/MindFlow/backend/internal/model"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/service"
)

// knowledgeAIClient 抽象知识点搜索所需的 AI 微服务能力
type knowledgeAIClient interface {
	SearchKnowledge(query string, topK int) ([]service.KnowledgeSearchResult, error)
}

// KnowledgeHandler 知识图谱处理器
type KnowledgeHandler struct {
	repo           *repository.KnowledgeRepo
	sourceLinkRepo *repository.SourceLinkRepo // 来源关联（可选）
	aiClient       knowledgeAIClient          // AI 微服务客户端（可选，用于语义搜索）
}

// NewKnowledgeHandler 创建知识图谱处理器
func NewKnowledgeHandler(repo *repository.KnowledgeRepo) *KnowledgeHandler {
	return &KnowledgeHandler{repo: repo}
}

// SetSourceLinkRepo 注入来源关联仓库（可选）。
func (h *KnowledgeHandler) SetSourceLinkRepo(repo *repository.SourceLinkRepo) {
	h.sourceLinkRepo = repo
}

// SetAIClient 注入 AI 微服务客户端（可选，用于语义搜索）。
func (h *KnowledgeHandler) SetAIClient(client knowledgeAIClient) {
	h.aiClient = client
}

// Graph GET /api/knowledge/graph
// 返回知识图谱的节点和边
func (h *KnowledgeHandler) Graph(ctx context.Context, c *app.RequestContext) {
	userID := getUserIDFromCtx(c)

	nodes, err := h.repo.ListNodes(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取知识点失败: " + err.Error()})
		return
	}

	edges, err := h.repo.ListEdges(ctx, userID)
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

	userID := getUserIDFromCtx(c)
	chain, err := h.repo.GetPrerequisiteChain(ctx, concept, 5, userID)
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
	userID := getUserIDFromCtx(c)

	nodes, err := h.repo.ListNodes(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "获取知识点失败: " + err.Error()})
		return
	}

	edges, err := h.repo.ListEdges(ctx, userID)
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

	userID := getUserIDFromCtx(c)
	if userID == nil || *userID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, utils.H{"error": "需要登录才能删除知识点"})
		return
	}

	if err := h.repo.DeleteByConcept(ctx, concept, *userID); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "删除失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"success": true})
}

// Sources GET /api/knowledge/sources?concept=xxx
// 查询知识点的所有来源（资料、测验、对话）
func (h *KnowledgeHandler) Sources(ctx context.Context, c *app.RequestContext) {
	concept := c.Query("concept")
	if concept == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "缺少 concept 参数"})
		return
	}

	if h.sourceLinkRepo == nil {
		c.JSON(http.StatusOK, utils.H{"concept": concept, "sources": []interface{}{}})
		return
	}

	userID := getUserIDFromCtx(c)
	links, err := h.sourceLinkRepo.GetLinksByConcept(ctx, concept, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "查询来源失败: " + err.Error()})
		return
	}

	if links == nil {
		links = []model.KnowledgeSourceLink{}
	}

	c.JSON(http.StatusOK, utils.H{
		"concept": concept,
		"sources": links,
	})
}

// SemanticSearch GET /api/knowledge/search?q=xxx&top_k=5
// 语义搜索知识点，通过 AI 微服务调用 Qdrant 向量搜索
func (h *KnowledgeHandler) SemanticSearch(ctx context.Context, c *app.RequestContext) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "缺少搜索关键词参数 q"})
		return
	}

	if h.aiClient == nil {
		c.JSON(http.StatusServiceUnavailable, utils.H{"error": "AI 微服务不可用，无法进行语义搜索"})
		return
	}

	topK := 5
	if topKStr := c.Query("top_k"); topKStr != "" {
		if v, err := strconv.Atoi(topKStr); err == nil && v > 0 {
			topK = v
		}
	}

	results, err := h.aiClient.SearchKnowledge(query, topK)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "知识点搜索失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{"results": results})
}
