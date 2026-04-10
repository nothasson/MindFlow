package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/agent"
)

// mockChatModel 用于测试
type mockChatModel struct{}

func (m *mockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{
		Role:    schema.Assistant,
		Content: "你觉得这个问题可以怎么思考？",
	}, nil
}

func (m *mockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *mockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestChatHandler_Handle(t *testing.T) {
	tutor := agent.NewTutorAgent(&mockChatModel{})
	orch := agent.NewOrchestrator(&mockChatModel{}, tutor)
	handler := NewChatHandler(orch, nil, nil, nil)

	// 创建 Hertz 测试引擎
	engine := route.NewEngine(config.NewOptions(nil))
	engine.POST("/api/chat", func(ctx context.Context, c *app.RequestContext) {
		handler.Handle(ctx, c)
	})

	// 构造请求
	reqBody := ChatRequest{
		Messages: []MessageDTO{
			{Role: "user", Content: "什么是二次方程？"},
		},
	}
	body, _ := json.Marshal(reqBody)

	// 发送请求
	w := ut.PerformRequest(engine, http.MethodPost, "/api/chat",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"},
	)

	resp := w.Result()
	if resp.StatusCode() != http.StatusOK {
		t.Fatalf("期望状态码 200，实际 %d，body: %s", resp.StatusCode(), string(resp.Body()))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(resp.Body(), &chatResp); err != nil {
		t.Fatalf("解析响应失败: %v, body: %s", err, string(resp.Body()))
	}

	if chatResp.Message.Role != "assistant" {
		t.Errorf("期望角色 assistant，实际 %s", chatResp.Message.Role)
	}

	if chatResp.Message.Content == "" {
		t.Error("回复内容不应为空")
	}
}

func TestChatHandler_EmptyMessages(t *testing.T) {
	tutor := agent.NewTutorAgent(&mockChatModel{})
	orch := agent.NewOrchestrator(&mockChatModel{}, tutor)
	handler := NewChatHandler(orch, nil, nil, nil)

	engine := route.NewEngine(config.NewOptions(nil))
	engine.POST("/api/chat", func(ctx context.Context, c *app.RequestContext) {
		handler.Handle(ctx, c)
	})

	reqBody := ChatRequest{Messages: []MessageDTO{}}
	body, _ := json.Marshal(reqBody)

	w := ut.PerformRequest(engine, http.MethodPost, "/api/chat",
		&ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"},
	)

	if w.Result().StatusCode() != http.StatusBadRequest {
		t.Errorf("空消息应返回 400，实际 %d", w.Result().StatusCode())
	}
}
