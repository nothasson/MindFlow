package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// AIClient Python AI 微服务 HTTP 客户端
type AIClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewAIClient 创建 AI 微服务客户端
func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// --- 请求/响应模型 ---

// ParseResponse 文档解析响应
type ParseResponse struct {
	Text     string `json:"text"`
	Pages    int    `json:"pages"`
	Filename string `json:"filename"`
}

// EmbedRequest Embedding 请求
type EmbedRequest struct {
	Texts []string `json:"texts"`
}

// EmbedResponse Embedding 响应
type EmbedResponse struct {
	Embeddings [][]float64 `json:"embeddings"`
	Dimension  int         `json:"dimension"`
}

// UpsertRequest 向量写入请求。
type UpsertRequest struct {
	Collection string            `json:"collection"`
	Texts      []string          `json:"texts"`
	Embeddings [][]float64       `json:"embeddings"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// UpsertResponse 向量写入响应。
type UpsertResponse struct {
	Inserted int `json:"inserted"`
}

// ParseURLRequest URL 解析请求。
type ParseURLRequest struct {
	URL string `json:"url"`
}

// ParseURLResponse URL 解析响应。
type ParseURLResponse struct {
	Text      string `json:"text"`
	Title     string `json:"title"`
	SourceURL string `json:"source_url"`
}

// SearchRequest 向量搜索请求
type SearchRequest struct {
	Query      string `json:"query"`
	Collection string `json:"collection"`
	Limit      int    `json:"limit"`
}

// SearchResult 搜索结果
type SearchResult struct {
	Text     string            `json:"text"`
	Score    float64           `json:"score"`
	Metadata map[string]string `json:"metadata"`
}

// SearchResponse 搜索响应
type SearchResponse struct {
	Results []SearchResult `json:"results"`
}

// ExtractRequest 知识点提取请求。
type ExtractRequest struct {
	Text string `json:"text"`
}

// KnowledgePoint 提取出的知识点。
type KnowledgePoint struct {
	Concept       string   `json:"concept"`
	Description   string   `json:"description"`
	Prerequisites []string `json:"prerequisites"`
}

// ExtractResponse 知识点提取响应。
type ExtractResponse struct {
	Points []KnowledgePoint `json:"points"`
}

// --- API 方法 ---

// ParseDocument 解析上传的文档
func (c *AIClient) ParseDocument(fileContent []byte, filename string) (*ParseResponse, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("创建 multipart 字段失败: %w", err)
	}
	if _, err := part.Write(fileContent); err != nil {
		return nil, fmt.Errorf("写入文件内容失败: %w", err)
	}
	writer.Close()

	req, err := http.NewRequest("POST", c.baseURL+"/parse", &buf)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	var result ParseResponse
	if err := c.doJSON(req, &result); err != nil {
		return nil, fmt.Errorf("文档解析失败: %w", err)
	}
	return &result, nil
}

// Embed 生成文本嵌入向量
func (c *AIClient) Embed(texts []string) (*EmbedResponse, error) {
	body := EmbedRequest{Texts: texts}
	var result EmbedResponse
	if err := c.postJSON("/embed", body, &result); err != nil {
		return nil, fmt.Errorf("Embedding 生成失败: %w", err)
	}
	return &result, nil
}

// ParseURL 解析网页正文。
func (c *AIClient) ParseURL(url string) (*ParseURLResponse, error) {
	body := ParseURLRequest{URL: url}
	var result ParseURLResponse
	if err := c.postJSON("/parse-url", body, &result); err != nil {
		return nil, fmt.Errorf("URL 解析失败: %w", err)
	}
	return &result, nil
}

// Upsert 将文本和向量写入向量库。
func (c *AIClient) Upsert(collection string, texts []string, embeddings [][]float64, metadata map[string]string) (*UpsertResponse, error) {
	body := UpsertRequest{
		Collection: collection,
		Texts:      texts,
		Embeddings: embeddings,
		Metadata:   metadata,
	}
	var result UpsertResponse
	if err := c.postJSON("/upsert", body, &result); err != nil {
		return nil, fmt.Errorf("向量写入失败: %w", err)
	}
	return &result, nil
}

// Search 向量相似度搜索
func (c *AIClient) Search(query, collection string, limit int) (*SearchResponse, error) {
	body := SearchRequest{
		Query:      query,
		Collection: collection,
		Limit:      limit,
	}
	var result SearchResponse
	if err := c.postJSON("/search", body, &result); err != nil {
		return nil, fmt.Errorf("向量搜索失败: %w", err)
	}
	return &result, nil
}

// ExtractKnowledgePoints 提取资料中的知识点。
func (c *AIClient) ExtractKnowledgePoints(text string) (*ExtractResponse, error) {
	body := ExtractRequest{Text: text}
	var result ExtractResponse
	if err := c.postJSON("/extract", body, &result); err != nil {
		return nil, fmt.Errorf("知识点提取失败: %w", err)
	}
	return &result, nil
}

// Health 检查 AI 服务健康状态
func (c *AIClient) Health() error {
	req, err := http.NewRequest("GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("AI 服务不可达: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI 服务健康检查失败: status %d", resp.StatusCode)
	}
	return nil
}

// --- 内部方法 ---

func (c *AIClient) postJSON(path string, body interface{}, result interface{}) error {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("序列化请求失败: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return c.doJSON(req, result)
}

func (c *AIClient) doJSON(req *http.Request, result interface{}) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI 服务返回错误 (status %d): %s", resp.StatusCode, string(respBody))
	}

	if err := json.Unmarshal(respBody, result); err != nil {
		return fmt.Errorf("解析响应失败: %w", err)
	}
	return nil
}
