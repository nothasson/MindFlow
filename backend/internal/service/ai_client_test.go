package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAIClient_Health(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" || r.Method != "GET" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	if err := client.Health(); err != nil {
		t.Fatalf("Health() error: %v", err)
	}
}

func TestAIClient_Health_Unavailable(t *testing.T) {
	client := NewAIClient("http://127.0.0.1:1") // 不可达地址
	if err := client.Health(); err == nil {
		t.Fatal("expected error for unavailable service")
	}
}

func TestAIClient_Embed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embed" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var req EmbedRequest
		json.NewDecoder(r.Body).Decode(&req)
		if len(req.Texts) != 2 {
			t.Errorf("expected 2 texts, got %d", len(req.Texts))
		}

		resp := EmbedResponse{
			Embeddings: [][]float64{{0.1, 0.2, 0.3}, {0.4, 0.5, 0.6}},
			Dimension:  3,
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.Embed([]string{"hello", "world"})
	if err != nil {
		t.Fatalf("Embed() error: %v", err)
	}
	if result.Dimension != 3 {
		t.Errorf("expected dimension 3, got %d", result.Dimension)
	}
	if len(result.Embeddings) != 2 {
		t.Errorf("expected 2 embeddings, got %d", len(result.Embeddings))
	}
}

func TestAIClient_Search(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/search" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var req SearchRequest
		json.NewDecoder(r.Body).Decode(&req)
		if req.Query != "特征值" {
			t.Errorf("expected query '特征值', got '%s'", req.Query)
		}

		resp := SearchResponse{
			Results: []SearchResult{
				{Text: "特征值分解是线性代数的重要概念", Score: 0.95, Metadata: map[string]string{}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.Search("特征值", "documents", 5)
	if err != nil {
		t.Fatalf("Search() error: %v", err)
	}
	if len(result.Results) != 1 {
		t.Errorf("expected 1 result, got %d", len(result.Results))
	}
	if result.Results[0].Score != 0.95 {
		t.Errorf("expected score 0.95, got %f", result.Results[0].Score)
	}
}

func TestAIClient_ParseDocument(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/parse" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if ct := r.Header.Get("Content-Type"); ct == "" {
			t.Error("missing Content-Type header")
		}

		resp := ParseResponse{
			Text:     "这是文档内容",
			Pages:    3,
			Filename: "test.pdf",
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.ParseDocument([]byte("fake-pdf-content"), "test.pdf")
	if err != nil {
		t.Fatalf("ParseDocument() error: %v", err)
	}
	if result.Pages != 3 {
		t.Errorf("expected 3 pages, got %d", result.Pages)
	}
	if result.Text != "这是文档内容" {
		t.Errorf("unexpected text: %s", result.Text)
	}
}

func TestAIClient_ParseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/parse-url" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var req ParseURLRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request failed: %v", err)
		}
		if req.URL != "https://example.com/article" {
			t.Errorf("unexpected url: %s", req.URL)
		}

		resp := ParseURLResponse{
			Text:      "这是网页正文",
			Title:     "示例文章",
			SourceURL: req.URL,
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.ParseURL("https://example.com/article")
	if err != nil {
		t.Fatalf("ParseURL() error: %v", err)
	}
	if result.Title != "示例文章" {
		t.Errorf("expected title 示例文章, got %s", result.Title)
	}
	if result.SourceURL != "https://example.com/article" {
		t.Errorf("unexpected source url: %s", result.SourceURL)
	}
}

func TestAIClient_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"detail":"internal error"}`))
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	_, err := client.Embed([]string{"test"})
	if err == nil {
		t.Fatal("expected error for server error response")
	}
}

func TestAIClient_Upsert(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/upsert" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var req UpsertRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request failed: %v", err)
		}
		if req.Collection != "documents" {
			t.Errorf("expected collection documents, got %s", req.Collection)
		}
		if len(req.Texts) != 2 {
			t.Errorf("expected 2 texts, got %d", len(req.Texts))
		}
		if req.Metadata["resource_id"] != "res-1" {
			t.Errorf("expected metadata resource_id res-1, got %s", req.Metadata["resource_id"])
		}

		resp := UpsertResponse{Inserted: 2}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.Upsert("documents", []string{"A", "B"}, [][]float64{{0.1, 0.2}, {0.3, 0.4}}, map[string]string{"resource_id": "res-1"})
	if err != nil {
		t.Fatalf("Upsert() error: %v", err)
	}
	if result.Inserted != 2 {
		t.Errorf("expected inserted 2, got %d", result.Inserted)
	}
}

func TestAIClient_ExtractKnowledgePoints(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/extract" || r.Method != "POST" {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}

		var req ExtractRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request failed: %v", err)
		}
		if req.Text != "线性代数关注向量空间。" {
			t.Errorf("unexpected text: %s", req.Text)
		}

		resp := ExtractResponse{
			Points: []KnowledgePoint{
				{Concept: "向量空间", Description: "线性代数的基础对象", Prerequisites: []string{"集合"}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewAIClient(server.URL)
	result, err := client.ExtractKnowledgePoints("线性代数关注向量空间。")
	if err != nil {
		t.Fatalf("ExtractKnowledgePoints() error: %v", err)
	}
	if len(result.Points) != 1 {
		t.Fatalf("expected 1 point, got %d", len(result.Points))
	}
	if result.Points[0].Concept != "向量空间" {
		t.Errorf("expected concept 向量空间, got %s", result.Points[0].Concept)
	}
	if len(result.Points[0].Prerequisites) != 1 || result.Points[0].Prerequisites[0] != "集合" {
		t.Errorf("unexpected prerequisites: %+v", result.Points[0].Prerequisites)
	}
}
