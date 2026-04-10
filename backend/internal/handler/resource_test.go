package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"
	"github.com/google/uuid"

	"github.com/nothasson/MindFlow/backend/internal/model"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/service"
)

type stubAIClient struct{}

func (s *stubAIClient) ParseDocument(fileContent []byte, filename string) (*service.ParseResponse, error) {
	return &service.ParseResponse{
		Text:     "线性代数研究向量空间与线性变换。",
		Pages:    2,
		Filename: filename,
	}, nil
}

func (s *stubAIClient) ParseURL(url string) (*service.ParseURLResponse, error) {
	return &service.ParseURLResponse{
		Text:      "这是网页正文，介绍向量空间与矩阵。",
		Title:     "线性代数网页",
		SourceURL: url,
	}, nil
}

func (s *stubAIClient) Embed(texts []string) (*service.EmbedResponse, error) {
	return &service.EmbedResponse{
		Embeddings: [][]float64{{0.1, 0.2, 0.3}},
		Dimension:  3,
	}, nil
}

func (s *stubAIClient) Upsert(collection string, texts []string, embeddings [][]float64, metadata map[string]string) (*service.UpsertResponse, error) {
	return &service.UpsertResponse{Inserted: len(texts)}, nil
}

func (s *stubAIClient) ExtractKnowledgePoints(text string) (*service.ExtractResponse, error) {
	return &service.ExtractResponse{
		Points: []service.KnowledgePoint{
			{Concept: "向量空间", Description: "线性代数的基础对象", Prerequisites: []string{"集合"}},
		},
	}, nil
}

func (s *stubAIClient) EmbedKnowledge(concept, description string) error {
	return nil
}

type stubResourceStore struct {
	created *model.Resource
	updated []resourceStatusUpdate
}

type resourceStatusUpdate struct {
	id         uuid.UUID
	status     string
	chunkCount int
}

func (s *stubResourceStore) Create(ctx context.Context, resource *model.Resource) (*model.Resource, error) {
	copied := *resource
	copied.ID = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	s.created = &copied
	return &copied, nil
}

func (s *stubResourceStore) UpdateStatus(ctx context.Context, id uuid.UUID, status string, chunkCount int) error {
	s.updated = append(s.updated, resourceStatusUpdate{id: id, status: status, chunkCount: chunkCount})
	return nil
}

func (s *stubResourceStore) UpdateOverview(ctx context.Context, id uuid.UUID, summary string, questions []string) error {
	return nil
}

type stubKnowledgeWriter struct {
	points []repository.ExtractedKnowledgePoint
}

func (s *stubKnowledgeWriter) UpsertExtractedPoints(ctx context.Context, points []repository.ExtractedKnowledgePoint) error {
	s.points = append(s.points, points...)
	return nil
}

func TestResourceHandler_Upload(t *testing.T) {
	resourceStore := &stubResourceStore{}
	knowledgeWriter := &stubKnowledgeWriter{}
	handler := NewResourceHandler(&stubAIClient{}, resourceStore, knowledgeWriter)

	engine := route.NewEngine(config.NewOptions(nil))
	engine.POST("/api/resources/upload", func(ctx context.Context, c *app.RequestContext) {
		handler.Upload(ctx, c)
	})

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "algebra.txt")
	if err != nil {
		t.Fatalf("CreateFormFile() error: %v", err)
	}
	if _, err := part.Write([]byte("线性代数内容")); err != nil {
		t.Fatalf("write multipart body failed: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer failed: %v", err)
	}

	w := ut.PerformRequest(engine, http.MethodPost, "/api/resources/upload",
		&ut.Body{Body: bytes.NewReader(body.Bytes()), Len: body.Len()},
		ut.Header{Key: "Content-Type", Value: writer.FormDataContentType()},
	)

	resp := w.Result()
	if resp.StatusCode() != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body: %s", resp.StatusCode(), string(resp.Body()))
	}

	var payload struct {
		ResourceID      string   `json:"resource_id"`
		Filename        string   `json:"filename"`
		Pages           int      `json:"pages"`
		Embedded        bool     `json:"embedded"`
		Status          string   `json:"status"`
		SourceType      string   `json:"source_type"`
		SourceURL       string   `json:"source_url"`
		KnowledgePoints []string `json:"knowledge_points"`
	}
	if err := json.Unmarshal(resp.Body(), &payload); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}

	if payload.ResourceID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("unexpected resource id: %s", payload.ResourceID)
	}
	if payload.Filename != "algebra.txt" {
		t.Fatalf("unexpected filename: %s", payload.Filename)
	}
	if !payload.Embedded {
		t.Fatal("expected embedded true")
	}
	if payload.SourceType != "file" {
		t.Fatalf("expected source type file, got %s", payload.SourceType)
	}
	if payload.SourceURL != "" {
		t.Fatalf("expected empty source url, got %s", payload.SourceURL)
	}
	if payload.Status != "ready" {
		t.Fatalf("expected status ready, got %s", payload.Status)
	}
	if len(payload.KnowledgePoints) != 1 || payload.KnowledgePoints[0] != "向量空间" {
		t.Fatalf("unexpected knowledge points: %+v", payload.KnowledgePoints)
	}

	if resourceStore.created == nil {
		t.Fatal("expected resource to be created")
	}
	if len(resourceStore.updated) == 0 {
		t.Fatal("expected resource status update")
	}
	if len(knowledgeWriter.points) != 1 || knowledgeWriter.points[0].Concept != "向量空间" {
		t.Fatalf("unexpected persisted knowledge points: %+v", knowledgeWriter.points)
	}
}

func TestResourceHandler_Upload_RequiresFile(t *testing.T) {
	handler := NewResourceHandler(&stubAIClient{}, &stubResourceStore{}, &stubKnowledgeWriter{})

	engine := route.NewEngine(config.NewOptions(nil))
	engine.POST("/api/resources/upload", func(ctx context.Context, c *app.RequestContext) {
		handler.Upload(ctx, c)
	})

	w := ut.PerformRequest(engine, http.MethodPost, "/api/resources/upload", nil)
	if w.Result().StatusCode() != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Result().StatusCode())
	}
}

func TestResourceHandler_ImportURL(t *testing.T) {
	resourceStore := &stubResourceStore{}
	knowledgeWriter := &stubKnowledgeWriter{}
	handler := NewResourceHandler(&stubAIClient{}, resourceStore, knowledgeWriter)

	engine := route.NewEngine(config.NewOptions(nil))
	engine.POST("/api/resources/import-url", func(ctx context.Context, c *app.RequestContext) {
		handler.ImportURL(ctx, c)
	})

	body := []byte(`{"url":"https://example.com/linear-algebra"}`)
	w := ut.PerformRequest(engine, http.MethodPost, "/api/resources/import-url",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"},
	)

	resp := w.Result()
	if resp.StatusCode() != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body: %s", resp.StatusCode(), string(resp.Body()))
	}

	var payload struct {
		Filename        string   `json:"filename"`
		SourceType      string   `json:"source_type"`
		SourceURL       string   `json:"source_url"`
		Status          string   `json:"status"`
		KnowledgePoints []string `json:"knowledge_points"`
	}
	if err := json.Unmarshal(resp.Body(), &payload); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}

	if payload.Filename != "线性代数网页" {
		t.Fatalf("unexpected filename: %s", payload.Filename)
	}
	if payload.SourceType != "url" {
		t.Fatalf("expected source type url, got %s", payload.SourceType)
	}
	if payload.SourceURL != "https://example.com/linear-algebra" {
		t.Fatalf("unexpected source url: %s", payload.SourceURL)
	}
	if payload.Status != "ready" {
		t.Fatalf("expected status ready, got %s", payload.Status)
	}
	if resourceStore.created == nil || resourceStore.created.SourceURL != "https://example.com/linear-algebra" {
		t.Fatalf("expected resource source url to be persisted, got %+v", resourceStore.created)
	}
}
