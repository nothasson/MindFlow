package handler

import (
	"context"
	"io"
	"net/http"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/model"
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
}

// resourceStore 抽象资料存储能力，便于测试。
type resourceStore interface {
	Create(ctx context.Context, resource *model.Resource) (*model.Resource, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string, chunkCount int) error
}

// knowledgeWriter 抽象知识点写入能力，便于测试。
type knowledgeWriter interface {
	UpsertExtractedPoints(ctx context.Context, points []repository.ExtractedKnowledgePoint) error
}

// URLImportRequest URL 导入请求。
type URLImportRequest struct {
	URL string `json:"url"`
}

// ResourceHandler 资料上传处理器。
type ResourceHandler struct {
	aiClient        resourceAIClient
	resourceStore   resourceStore
	knowledgeWriter knowledgeWriter
}

// NewResourceHandler 创建资料处理器。
func NewResourceHandler(aiClient resourceAIClient, resourceStore resourceStore, knowledgeWriter knowledgeWriter) *ResourceHandler {
	return &ResourceHandler{
		aiClient:        aiClient,
		resourceStore:   resourceStore,
		knowledgeWriter: knowledgeWriter,
	}
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
	resource, err := h.resourceStore.Create(ctx, &model.Resource{
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
			}
		}
	}

	status, _ := response["status"].(string)
	if err := h.resourceStore.UpdateStatus(ctx, resource.ID, status, len(chunks)); err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "更新资料状态失败: " + err.Error()})
		return
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
