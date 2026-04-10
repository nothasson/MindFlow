package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type variantMockChatModel struct{}

func (m *variantMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{
		Role: schema.Assistant,
		Content: `{
  "variant_type": "parameter",
  "question": "解方程 2x^2 - 7x + 3 = 0",
  "hint": "尝试使用因式分解法",
  "difficulty": "medium"
}`,
	}, nil
}

func (m *variantMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *variantMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestVariantQuizAgent_Generate(t *testing.T) {
	agent := NewVariantQuizAgent(&variantMockChatModel{})

	result, err := agent.Generate(context.Background(), "一元二次方程", "解方程 x^2-5x+6=0", "x=1, x=6", "concept_confusion")
	if err != nil {
		t.Fatalf("Generate 失败: %v", err)
	}
	if result == "" {
		t.Error("结果不应为空")
	}
	if !strings.Contains(result, "variant_type") {
		t.Error("结果应包含 variant_type 字段")
	}
}

func TestVariantQuizAgent_PromptContainsDefense(t *testing.T) {
	agent := NewVariantQuizAgent(&variantMockChatModel{})
	if !strings.Contains(agent.systemPrompt, "角色安全声明") {
		t.Error("system prompt 应包含防御声明")
	}
}
