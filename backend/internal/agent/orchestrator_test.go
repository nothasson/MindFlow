package agent

import (
	"context"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type orchestratorMockChatModel struct{}

func (m *orchestratorMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{
		Role:    schema.Assistant,
		Content: "你觉得这个问题可以怎么思考？",
	}, nil
}

func (m *orchestratorMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *orchestratorMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestOrchestrator_Route_DefaultToTutor(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
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

func TestOrchestrator_Route_QuizKeyword(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
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

func TestOrchestrator_Route_CurriculumKeyword(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
	tutor := NewTutorAgent(mockModel)
	orch := NewOrchestrator(mockModel, tutor)

	decision, err := orch.Route(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "接下来学什么比较好"},
	})
	if err != nil {
		t.Fatalf("Route 失败: %v", err)
	}
	if decision.Agent != AgentTypeCurriculum {
		t.Errorf("期望路由到 curriculum，实际 %s", decision.Agent)
	}
}

func TestOrchestrator_Route_EmptyMessages(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
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

func TestOrchestrator_Chat(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
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
