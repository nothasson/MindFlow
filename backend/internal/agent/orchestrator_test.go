package agent

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// routeMockChatModel 根据 system prompt 内容判断是路由调用还是 agent 调用
type routeMockChatModel struct {
	routeAgent AgentType // Route 调用时返回的 agent 类型
}

func (m *routeMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	// 检查是否是路由调用（system prompt 包含"调度器"）
	if len(input) > 0 && strings.Contains(input[0].Content, "调度器") {
		decision := RouteDecision{Agent: m.routeAgent, Reason: "mock 路由决策"}
		data, _ := json.Marshal(decision)
		return &schema.Message{Role: schema.Assistant, Content: string(data)}, nil
	}

	// 其他 agent 调用
	return &schema.Message{
		Role:    schema.Assistant,
		Content: "你觉得这个问题可以怎么思考？",
	}, nil
}

func (m *routeMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *routeMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestOrchestrator_Route_LLMDecision_Tutor(t *testing.T) {
	mockModel := &routeMockChatModel{routeAgent: AgentTypeTutor}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	decision, err := orch.Route(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "什么是二叉树？"},
	})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeTutor {
		t.Errorf("期望路由到 tutor，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Route_LLMDecision_Quiz(t *testing.T) {
	mockModel := &routeMockChatModel{routeAgent: AgentTypeQuiz}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	decision, err := orch.Route(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "考考我，出几道题"},
	})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeQuiz {
		t.Errorf("期望路由到 quiz，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Route_LLMDecision_Content(t *testing.T) {
	mockModel := &routeMockChatModel{routeAgent: AgentTypeContent}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)
	// 不设置 content agent，应回退到 tutor
	decision, err := orch.Route(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "帮我看看上传的那个 PDF"},
	})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeTutor {
		t.Errorf("content agent 不可用时应回退到 tutor，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Route_EmptyMessages(t *testing.T) {
	mockModel := &routeMockChatModel{routeAgent: AgentTypeTutor}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	decision, err := orch.Route(context.Background(), []*schema.Message{})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeTutor {
		t.Errorf("空消息应默认 tutor，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Route_LLMFailure_FallbackToTutor(t *testing.T) {
	// 返回无法解析的 JSON，应回退到 tutor
	mockModel := &badJSONMockChatModel{}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	decision, err := orch.Route(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "你好"},
	})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeTutor {
		t.Errorf("LLM 返回非法 JSON 应回退到 tutor，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Chat(t *testing.T) {
	mockModel := &routeMockChatModel{routeAgent: AgentTypeTutor}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	reply, err := orch.Chat(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "你好"},
	})
	if err != nil {
		t.Fatalf("Chat 失败: %v", err)
	}
	if reply == "" {
		t.Error("回复不应为空")
	}
}

func TestCleanJSON(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{`{"agent":"tutor","reason":"test"}`, `{"agent":"tutor","reason":"test"}`},
		{"```json\n{\"agent\":\"quiz\"}\n```", `{"agent":"quiz"}`},
		{"  \n{\"agent\":\"tutor\"}\n  ", `{"agent":"tutor"}`},
	}
	for _, tt := range tests {
		got := cleanJSON(tt.input)
		if got != tt.expected {
			t.Errorf("cleanJSON(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

// badJSONMockChatModel 返回无法解析为 RouteDecision 的内容
type badJSONMockChatModel struct{}

func (m *badJSONMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{Role: schema.Assistant, Content: "这不是 JSON"}, nil
}

func (m *badJSONMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *badJSONMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}
