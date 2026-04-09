package handler

import (
	"context"
	"io"
	"net/http"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/service"
)

// ResourceHandler 资料上传处理器
type ResourceHandler struct {
	aiClient *service.AIClient
}

// NewResourceHandler 创建资料处理器
func NewResourceHandler(aiClient *service.AIClient) *ResourceHandler {
	return &ResourceHandler{aiClient: aiClient}
}

// Upload POST /api/resources/upload
// 接收前端上传的文件，调用 AI 微服务解析，然后生成 Embedding 存入向量库
func (h *ResourceHandler) Upload(ctx context.Context, c *app.RequestContext) {
	if h.aiClient == nil {
		c.JSON(http.StatusServiceUnavailable, utils.H{"error": "AI 微服务不可用"})
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

	// 1. 调用 AI 微服务解析文档
	parseResult, err := h.aiClient.ParseDocument(content, file.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "文档解析失败: " + err.Error()})
		return
	}

	// 2. 将解析文本分块并生成 Embedding 存入向量库
	chunks := splitText(parseResult.Text, 500)
	if len(chunks) > 0 {
		embedResult, err := h.aiClient.Embed(chunks)
		if err != nil {
			// Embedding 失败不阻塞，记录日志即可
			c.JSON(http.StatusOK, utils.H{
				"filename": parseResult.Filename,
				"pages":    parseResult.Pages,
				"text":     parseResult.Text,
				"chunks":   len(chunks),
				"embedded": false,
				"warning":  "Embedding 生成失败: " + err.Error(),
			})
			return
		}

		_ = embedResult // 后续可以调用 vector store 的 upsert
	}

	c.JSON(http.StatusOK, utils.H{
		"filename": parseResult.Filename,
		"pages":    parseResult.Pages,
		"text":     parseResult.Text,
		"chunks":   len(chunks),
		"embedded": true,
	})
}

// splitText 简单按字符数分块
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
