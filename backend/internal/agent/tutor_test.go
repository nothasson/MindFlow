package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// mockChatModel 用于测试的 mock ChatModel
type mockChatModel struct {
	generateFunc func(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error)
}

func (m *mockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return m.generateFunc(ctx, input, opts...)
}

func (m *mockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *mockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

// TestTutorAgent_SystemPrompt 验证系统提示词包含苏格拉底核心规则
func TestTutorAgent_SystemPrompt(t *testing.T) {
	mock := &mockChatModel{}
	tutor := NewTutorAgent(mock)

	prompt := tutor.GetSystemPrompt()

	// 必须包含核心苏格拉底规则
	requiredRules := []string{
		"绝不直接给出答案",
		"提问引导",
		"中文",
	}

	for _, rule := range requiredRules {
		if !strings.Contains(prompt, rule) {
			t.Errorf("系统提示词缺少关键规则: %q", rule)
		}
	}
}

// TestTutorAgent_Chat 验证 Chat 方法正确组装消息并调用 LLM
func TestTutorAgent_Chat(t *testing.T) {
	var capturedMessages []*schema.Message

	mock := &mockChatModel{
		generateFunc: func(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
			capturedMessages = input
			return &schema.Message{
				Role:    schema.Assistant,
				Content: "你觉得这个问题可以从哪个角度思考呢？",
			}, nil
		},
	}

	tutor := NewTutorAgent(mock)
	userMessages := []*schema.Message{
		schema.UserMessage("什么是二次方程？"),
	}

	reply, err := tutor.Chat(context.Background(), userMessages)
	if err != nil {
		t.Fatalf("Chat 返回错误: %v", err)
	}

	// 验证回复不为空
	if reply == "" {
		t.Error("Chat 返回了空回复")
	}

	// 验证消息组装：第一条必须是 system message
	if len(capturedMessages) != 2 {
		t.Fatalf("期望 2 条消息（system + user），实际 %d 条", len(capturedMessages))
	}

	if capturedMessages[0].Role != schema.System {
		t.Errorf("第一条消息应为 system，实际为 %s", capturedMessages[0].Role)
	}

	if capturedMessages[1].Role != schema.User {
		t.Errorf("第二条消息应为 user，实际为 %s", capturedMessages[1].Role)
	}

	// 验证 system message 包含苏格拉底规则
	if !strings.Contains(capturedMessages[0].Content, "绝不直接给出答案") {
		t.Error("system message 缺少苏格拉底规则")
	}
}

// TestTutorAgent_ChatWithHistory 验证多轮对话历史正确传递
func TestTutorAgent_ChatWithHistory(t *testing.T) {
	var capturedMessages []*schema.Message

	mock := &mockChatModel{
		generateFunc: func(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
			capturedMessages = input
			return &schema.Message{
				Role:    schema.Assistant,
				Content: "很好，继续思考",
			}, nil
		},
	}

	tutor := NewTutorAgent(mock)
	history := []*schema.Message{
		schema.UserMessage("什么是导数？"),
		{Role: schema.Assistant, Content: "你能想想变化率是什么意思吗？"},
		schema.UserMessage("变化率就是变化的速度？"),
	}

	_, err := tutor.Chat(context.Background(), history)
	if err != nil {
		t.Fatalf("Chat 返回错误: %v", err)
	}

	// system + 3 条历史 = 4 条
	if len(capturedMessages) != 4 {
		t.Fatalf("期望 4 条消息，实际 %d 条", len(capturedMessages))
	}
}
