package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type diagnosticMockChatModel struct{}

func (m *diagnosticMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{
		Role: schema.Assistant,
		Content: `{
  "correctness": "wrong",
  "primary_error": {"type": "concept_confusion", "description": "混淆了因式分解的根与系数关系"},
  "metacognitive_error": {"type": "overconfidence", "description": "对错误答案非常确定"},
  "analysis": "学生将 x^2 - 5x + 6 的两个根 2 和 3 错误回答为 1 和 6，混淆了韦达定理的使用。",
  "guidance_strategy": "用反例提问",
  "prerequisite_gap": "韦达定理"
}`,
	}, nil
}

func (m *diagnosticMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *diagnosticMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestDiagnosticAgent_Diagnose(t *testing.T) {
	mockModel := &diagnosticMockChatModel{}
	diag := NewDiagnosticAgent(mockModel)

	result, err := diag.Diagnose(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "x^2 - 5x + 6 = 0 的解是 x=1 和 x=6"},
	})
	if err != nil {
		t.Fatalf("Diagnose 失败: %v", err)
	}
	if result == "" {
		t.Error("诊断结果不应为空")
	}
}

func TestDiagnosticAgent_DiagnoseStructured(t *testing.T) {
	mockModel := &diagnosticMockChatModel{}
	diag := NewDiagnosticAgent(mockModel)

	result, raw, err := diag.DiagnoseStructured(context.Background(), []*schema.Message{
		{Role: schema.User, Content: "x^2 - 5x + 6 = 0 的解是 x=1 和 x=6"},
	})
	if err != nil {
		t.Fatalf("DiagnoseStructured 失败: %v", err)
	}
	if raw == "" {
		t.Error("原始输出不应为空")
	}
	if result == nil {
		t.Fatal("结构化结果不应为 nil")
	}
	if result.Correctness != "wrong" {
		t.Errorf("期望 correctness=wrong，实际 %s", result.Correctness)
	}
	if result.PrimaryError.Type != "concept_confusion" {
		t.Errorf("期望 primary_error.type=concept_confusion，实际 %s", result.PrimaryError.Type)
	}
	if result.MetacognitiveError.Type != "overconfidence" {
		t.Errorf("期望 metacognitive_error.type=overconfidence，实际 %s", result.MetacognitiveError.Type)
	}
	if result.PrerequisiteGap == nil || *result.PrerequisiteGap != "韦达定理" {
		t.Error("期望 prerequisite_gap=韦达定理")
	}
}

func TestDiagnosticAgent_SystemPrompt(t *testing.T) {
	mockModel := &diagnosticMockChatModel{}
	diag := NewDiagnosticAgent(mockModel)

	if diag.systemPrompt == "" {
		t.Error("system prompt 不应为空")
	}

	// 验证 5+3 种错误类型都在 Prompt 中
	errorTypes := []string{
		"knowledge_gap", "concept_confusion", "concept_error", "method_error", "calculation_error",
		"overconfidence", "strategy_error", "unclear_expression",
	}
	for _, et := range errorTypes {
		if !strings.Contains(diag.systemPrompt, et) {
			t.Errorf("system prompt 应包含错误类型 %s", et)
		}
	}

	// 验证防御声明
	if !strings.Contains(diag.systemPrompt, "角色安全声明") {
		t.Error("system prompt 应包含防御声明")
	}
}

func TestParseDiagnosticResult(t *testing.T) {
	raw := `{"correctness":"correct","primary_error":{"type":"none","description":""},"metacognitive_error":{"type":"none","description":""},"analysis":"回答正确","guidance_strategy":"深入追问","prerequisite_gap":null}`

	result, err := ParseDiagnosticResult(raw)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if result.Correctness != "correct" {
		t.Errorf("期望 correct，实际 %s", result.Correctness)
	}
	if result.PrerequisiteGap != nil {
		t.Error("正确回答不应有前置知识缺口")
	}
}
