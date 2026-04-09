package agent

import (
	"context"
	"testing"

	"github.com/cloudwego/eino/schema"
)

func TestDiagnosticAgent_Diagnose(t *testing.T) {
	mockModel := &orchestratorMockChatModel{}
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
	mockModel := &orchestratorMockChatModel{}
	diag := NewDiagnosticAgent(mockModel)

	if diag.systemPrompt == "" {
		t.Error("system prompt 不应为空")
	}
	// 验证包含关键诊断词
	keywords := []string{"概念错误", "方法错误", "粗心错误"}
	for _, kw := range keywords {
		if !containsKeyword(diag.systemPrompt, kw) {
			t.Errorf("system prompt 应包含 %s", kw)
		}
	}
}
