package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	mdl "github.com/nothasson/MindFlow/backend/internal/model"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/service"
)

// resourceAIClient 抽象 AI 微服务能力，便于测试。
type resourceAIClient interface {
	ParseDocument(fileContent []byte, filename string) (*service.ParseResponse, error)
	ParseURL(url string) (*service.ParseURLResponse, error)
	Embed(texts []string) (*service.EmbedResponse, error)
	Upsert(collection string, texts []string, embeddings [][]float64, metadata map[string]string) (*service.UpsertResponse, error)
	ExtractKnowledgePoints(text string) (*service.ExtractResponse, error)
	EmbedKnowledge(concept, description string) error
}

// resourceStore 抽象资料存储能力，便于测试。
type resourceStore interface {
	Create(ctx context.Context, resource *mdl.Resource, userID ...*uuid.UUID) (*mdl.Resource, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string, chunkCount int) error
	UpdateOverview(ctx context.Context, id uuid.UUID, summary string, questions []string) error
}

// knowledgeWriter 抽象知识点写入能力，便于测试。
type knowledgeWriter interface {
	UpsertExtractedPoints(ctx context.Context, points []repository.ExtractedKnowledgePoint) error
}

// sourceLinkWriter 抽象来源关联写入能力，便于测试。
type sourceLinkWriter interface {
	CreateLink(ctx context.Context, concept, sourceType string, sourceID uuid.UUID, position string) error
}

// URLImportRequest URL 导入请求。
type URLImportRequest struct {
	URL string `json:"url"`
}

// ResourceHandler 资料上传处理器。
type ResourceHandler struct {
	aiClient         resourceAIClient
	resourceStore    resourceStore
	knowledgeWriter  knowledgeWriter
	sourceLinkWriter sourceLinkWriter // 来源关联写入（可选）
	chatModel        model.ChatModel  // 用于生成资料概览
}

// NewResourceHandler 创建资料处理器。
// chatModel 可为 nil，此时跳过概览生成。
func NewResourceHandler(aiClient resourceAIClient, resourceStore resourceStore, knowledgeWriter knowledgeWriter, chatModel ...model.ChatModel) *ResourceHandler {
	h := &ResourceHandler{
		aiClient:        aiClient,
		resourceStore:   resourceStore,
		knowledgeWriter: knowledgeWriter,
	}
	if len(chatModel) > 0 && chatModel[0] != nil {
		h.chatModel = chatModel[0]
	}
	return h
}

// SetSourceLinkWriter 注入来源关联写入器（可选）。
func (h *ResourceHandler) SetSourceLinkWriter(w sourceLinkWriter) {
	h.sourceLinkWriter = w
}

// Upload POST /api/resources/upload
// 接收前端上传的文件，调用 AI 微服务解析，并将资料持久化到数据库与向量库。
func (h *ResourceHandler) Upload(ctx context.Context, c *app.RequestContext) {
	if err := h.ensureReady(c); err != nil {
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请上传文件"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "读取文件失败"})
		return
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "读取文件内容失败"})
		return
	}

	parseResult, err := h.aiClient.ParseDocument(content, file.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "文档解析失败: " + err.Error()})
		return
	}

	h.ingestResource(ctx, c, ingestInput{
		SourceType:       "file",
		Title:            parseResult.Filename,
		DisplayName:      parseResult.Filename,
		OriginalFilename: parseResult.Filename,
		ContentText:      parseResult.Text,
		Pages:            parseResult.Pages,
	})
}

// ImportURL POST /api/resources/import-url
// 导入网页链接并将正文纳入学习资料管线。
func (h *ResourceHandler) ImportURL(ctx context.Context, c *app.RequestContext) {
	if err := h.ensureReady(c); err != nil {
		return
	}

	var req URLImportRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.H{"error": "请求格式错误: " + err.Error()})
		return
	}
	url := strings.TrimSpace(req.URL)
	if url == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "URL 不能为空"})
		return
	}

	parseResult, err := h.aiClient.ParseURL(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "URL 解析失败: " + err.Error()})
		return
	}

	displayName := strings.TrimSpace(parseResult.Title)
	if displayName == "" {
		displayName = url
	}

	h.ingestResource(ctx, c, ingestInput{
		SourceType:       "url",
		Title:            displayName,
		DisplayName:      displayName,
		OriginalFilename: displayName,
		SourceURL:        parseResult.SourceURL,
		ContentText:      parseResult.Text,
		Pages:            1,
	})
}

type ingestInput struct {
	SourceType       string
	Title            string
	DisplayName      string
	OriginalFilename string
	SourceURL        string
	ContentText      string
	Pages            int
}

func (h *ResourceHandler) ensureReady(c *app.RequestContext) error {
	if h.aiClient == nil {
		c.JSON(http.StatusServiceUnavailable, utils.H{"error": "AI 微服务不可用"})
		return http.ErrServerClosed
	}
	if h.resourceStore == nil {
		c.JSON(http.StatusServiceUnavailable, utils.H{"error": "资料存储不可用"})
		return http.ErrServerClosed
	}
	return nil
}

func (h *ResourceHandler) ingestResource(ctx context.Context, c *app.RequestContext, input ingestInput) {
	chunks := splitText(input.ContentText, 500)
	resource, err := h.resourceStore.Create(ctx, &mdl.Resource{
		SourceType:       input.SourceType,
		Title:            input.Title,
		OriginalFilename: input.OriginalFilename,
		SourceURL:        input.SourceURL,
		ContentText:      input.ContentText,
		Pages:            input.Pages,
		ChunkCount:       len(chunks),
		Status:           "parsed",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "保存资料失败: " + err.Error()})
		return
	}

	response := utils.H{
		"resource_id":      resource.ID.String(),
		"filename":         input.DisplayName,
		"pages":            input.Pages,
		"text":             input.ContentText,
		"chunks":           len(chunks),
		"embedded":         false,
		"status":           "parsed",
		"source_type":      input.SourceType,
		"source_url":       input.SourceURL,
		"knowledge_points": []string{},
	}
	warnings := make([]string, 0, 2)

	if len(chunks) > 0 {
		embedResult, err := h.aiClient.Embed(chunks)
		if err != nil {
			warnings = append(warnings, "Embedding 生成失败: "+err.Error())
		} else {
			_, err = h.aiClient.Upsert("documents", chunks, embedResult.Embeddings, map[string]string{
				"resource_id": resource.ID.String(),
				"filename":    input.DisplayName,
				"source_type": input.SourceType,
				"source_url":  input.SourceURL,
			})
			if err != nil {
				warnings = append(warnings, "向量写入失败: "+err.Error())
			} else {
				response["embedded"] = true
				response["status"] = "indexed"
			}
		}
	}

	extractResult, err := h.aiClient.ExtractKnowledgePoints(input.ContentText)
	if err != nil {
		warnings = append(warnings, "知识点提取失败: "+err.Error())
	} else if h.knowledgeWriter != nil {
		points := make([]repository.ExtractedKnowledgePoint, 0, len(extractResult.Points))
		names := make([]string, 0, len(extractResult.Points))
		for _, point := range extractResult.Points {
			if point.Concept == "" {
				continue
			}
			rels := make([]repository.ExtractedRelation, 0, len(point.Relations))
			for _, r := range point.Relations {
				rels = append(rels, repository.ExtractedRelation{
					Target:   r.Target,
					Type:     r.Type,
					Strength: r.Strength,
				})
			}
			points = append(points, repository.ExtractedKnowledgePoint{
				Concept:       point.Concept,
				Description:   point.Description,
				Prerequisites: point.Prerequisites,
				BloomLevel:    point.BloomLevel,
				Importance:    point.Importance,
				Granularity:   point.Granularity,
				Relations:     rels,
			})
			names = append(names, point.Concept)
		}
		if len(points) > 0 {
			if err := h.knowledgeWriter.UpsertExtractedPoints(ctx, points); err != nil {
				warnings = append(warnings, "知识图谱写入失败: "+err.Error())
			} else {
				response["knowledge_points"] = names
				if response["status"] == "indexed" {
					response["status"] = "ready"
				}
				// 知识点向量化：将每个知识点写入向量库，解锁语义搜索
				for _, pt := range points {
					if err := h.aiClient.EmbedKnowledge(pt.Concept, pt.Description); err != nil {
						log.Printf("知识点向量化失败 (concept=%s): %v", pt.Concept, err)
					}
				}
				// 写入来源关联：将提取出的知识点与资料建立关联
				if h.sourceLinkWriter != nil {
					for _, name := range names {
						if err := h.sourceLinkWriter.CreateLink(ctx, name, "resource", resource.ID, ""); err != nil {
							log.Printf("写入来源关联失败 (concept=%s, resource=%s): %v", name, resource.ID, err)
						}
					}
				}

				// 知识点向量化：将每个知识点的 concept+description 存入 Qdrant
				for _, point := range extractResult.Points {
					if point.Concept == "" {
						continue
					}
					if err := h.aiClient.EmbedKnowledge(point.Concept, point.Description); err != nil {
						log.Printf("知识点向量化失败 (concept=%s): %v", point.Concept, err)
					}
				}
			}
		}
	}

	status, _ := response["status"].(string)
	if err := h.resourceStore.UpdateStatus(ctx, resource.ID, status, len(chunks)); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "更新资料状态失败: " + err.Error()})
		return
	}

	// 调用 LLM 生成资料摘要和建议学习问题
	if h.chatModel != nil && input.ContentText != "" {
		summary, questions, err := h.generateOverview(ctx, input.Title, input.ContentText)
		if err != nil {
			warnings = append(warnings, "概览生成失败: "+err.Error())
		} else {
			response["summary"] = summary
			response["questions"] = questions
			// 持久化概览到数据库
			if err := h.resourceStore.UpdateOverview(ctx, resource.ID, summary, questions); err != nil {
				warnings = append(warnings, "概览保存失败: "+err.Error())
			}
		}
	}

	if len(warnings) > 0 {
		response["warning"] = warnings[0]
	}

	c.JSON(http.StatusOK, response)
}

// splitText 简单按字符数分块。
func splitText(text string, chunkSize int) []string {
	runes := []rune(text)
	if len(runes) == 0 {
		return nil
	}

	var chunks []string
	for i := 0; i < len(runes); i += chunkSize {
		end := i + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		chunk := string(runes[i:end])
		if len(chunk) > 0 {
			chunks = append(chunks, chunk)
		}
	}
	return chunks
}

// overviewResponse LLM 生成概览的 JSON 响应结构
type overviewResponse struct {
	Summary   string   `json:"summary"`
	Questions []string `json:"questions"`
}

// generateOverview 调用 LLM 生成资料摘要和建议学习问题。
// 截取资料前 2000 字符作为输入，避免 token 过长。
func (h *ResourceHandler) generateOverview(ctx context.Context, title, contentText string) (string, []string, error) {
	// 截取前 2000 字符，避免超出 LLM token 限制
	runes := []rune(contentText)
	if len(runes) > 2000 {
		runes = runes[:2000]
	}
	excerpt := string(runes)

	prompt := fmt.Sprintf(`请为以下学习资料生成概览。

资料标题：%s
资料内容（节选）：
%s

请以 JSON 格式返回，包含两个字段：
1. "summary"：200字以内的中文摘要，概括资料的核心内容和学习价值
2. "questions"：3-5个建议学习问题，帮助学生围绕资料展开思考

只返回 JSON，不要包含其他文字或 markdown 代码块标记。
示例格式：
{"summary":"这份资料介绍了...","questions":["问题1","问题2","问题3"]}`, title, excerpt)

	messages := []*schema.Message{
		schema.SystemMessage("你是一个学习资料分析助手。请严格按照要求返回 JSON 格式的概览。"),
		schema.UserMessage(prompt),
	}

	resp, err := h.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", nil, fmt.Errorf("LLM 调用失败: %w", err)
	}

	// 清理可能的 markdown 代码块包装
	content := strings.TrimSpace(resp.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var overview overviewResponse
	if err := json.Unmarshal([]byte(content), &overview); err != nil {
		return "", nil, fmt.Errorf("解析概览 JSON 失败: %w", err)
	}

	// 截断摘要到 200 字
	summaryRunes := []rune(overview.Summary)
	if len(summaryRunes) > 200 {
		overview.Summary = string(summaryRunes[:200]) + "..."
	}

	// 限制问题数量在 3-5 个
	if len(overview.Questions) > 5 {
		overview.Questions = overview.Questions[:5]
	}

	return overview.Summary, overview.Questions, nil
}
