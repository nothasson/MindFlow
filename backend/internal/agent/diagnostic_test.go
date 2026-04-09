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
		Role:    schema.Assistant,
		Content: "诊断结果：概念错误，学生混淆了因式分解的根与系数关系",
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

func TestDiagnosticAgent_SystemPrompt(t *testing.T) {
	mockModel := &diagnosticMockChatModel{}
	diag := NewDiagnosticAgent(mockModel)

	if diag.systemPrompt == "" {
		t.Error("system prompt 不应为空")
	}
	keywords := []string{"概念错误", "方法错误", "粗心错误"}
	for _, kw := range keywords {
		if !strings.Contains(diag.systemPrompt, kw) {
			t.Errorf("system prompt 应包含 %s", kw)
		}
	}
}
