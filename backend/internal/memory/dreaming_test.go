package memory

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type dreamingMockChatModel struct{}

func (m *dreamingMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	// 根据 system prompt 判断是更新长期记忆还是生成总结
	if len(input) > 0 {
		sysContent := input[0].Content
		if len(sysContent) > 20 && sysContent[:20] == "你是 MindFlow 的记忆整理" {
			return &schema.Message{
				Role: schema.Assistant,
				Content: `# MEMORY.md - 学习画像

## 学习偏好
- 偏好语言：中文

## 知识掌握度

### 已掌握
- 线性代数/矩阵乘法 (0.92) - 2026-04-09 掌握

### 薄弱点
- 线性代数/特征值分解 (0.25) - 概念混淆

### 错误模式
- 常混淆相似概念

## 学习历史
- 2026-04-09: 学习矩阵乘法，特征值分解有困难

---
*最后更新：2026-04-09*`,
			}, nil
		}
	}

	// 学习总结
	return &schema.Message{
		Role:    schema.Assistant,
		Content: "今日掌握了矩阵乘法，特征值分解仍需加强。",
	}, nil
}

func (m *dreamingMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *dreamingMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

func TestDreamingSweep_Run(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 store 失败: %v", err)
	}

	// 写入一条每日日志
	err = store.AppendDailyLog("2026-04-09", "学习了矩阵乘法，掌握得不错。特征值分解还是搞不懂。")
	if err != nil {
		t.Fatalf("写入日志失败: %v", err)
	}

	mockModel := &dreamingMockChatModel{}
	sweep := NewDreamingSweep(store, mockModel)

	err = sweep.Run(context.Background(), "2026-04-09")
	if err != nil {
		t.Fatalf("Dreaming Sweep 失败: %v", err)
	}

	// 验证 MEMORY.md 已更新
	memory, err := store.GetLongTermMemory()
	if err != nil {
		t.Fatalf("读取长期记忆失败: %v", err)
	}
	if memory == "" {
		t.Error("长期记忆不应为空")
	}
	if !contains(memory, "矩阵乘法") {
		t.Error("长期记忆应包含矩阵乘法")
	}
	if !contains(memory, "特征值分解") {
		t.Error("长期记忆应包含特征值分解")
	}

	// 验证 learnings 已生成
	learningPath := filepath.Join(tmpDir, "learnings", "2026-04-09.md")
	data, err := os.ReadFile(learningPath)
	if err != nil {
		t.Fatalf("读取学习总结失败: %v", err)
	}
	if len(data) == 0 {
		t.Error("学习总结不应为空")
	}
}

func TestDreamingSweep_Run_NoLog(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 store 失败: %v", err)
	}

	mockModel := &dreamingMockChatModel{}
	sweep := NewDreamingSweep(store, mockModel)

	// 没有日志时应该直接返回 nil
	err = sweep.Run(context.Background(), "2026-04-09")
	if err != nil {
		t.Fatalf("无日志时不应报错: %v", err)
	}

	// MEMORY.md 不应被创建
	memory, _ := store.GetLongTermMemory()
	if memory != "" {
		t.Error("无日志时不应生成长期记忆")
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsSubstring(s, sub))
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
