package memory

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type dreamingMockChatModel struct{}

func (m *dreamingMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	// 用 strings.Contains 判断是记忆整理还是学习总结
	if len(input) > 0 && strings.Contains(input[0].Content, "记忆整理") {
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
	mem, err := store.GetLongTermMemory()
	if err != nil {
		t.Fatalf("读取长期记忆失败: %v", err)
	}
	if mem == "" {
		t.Error("长期记忆不应为空")
	}
	if !strings.Contains(mem, "矩阵乘法") {
		t.Error("长期记忆应包含矩阵乘法")
	}
	if !strings.Contains(mem, "特征值分解") {
		t.Error("长期记忆应包含特征值分解")
	}

	// 验证 learnings 已生成且内容正确
	learningPath := filepath.Join(tmpDir, "learnings", "2026-04-09.md")
	data, err := os.ReadFile(learningPath)
	if err != nil {
		t.Fatalf("读取学习总结失败: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "2026-04-09 学习总结") {
		t.Error("学习总结应包含日期标题")
	}
	if !strings.Contains(content, "矩阵乘法") {
		t.Error("学习总结应包含矩阵乘法")
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

	err = sweep.Run(context.Background(), "2026-04-09")
	if err != nil {
		t.Fatalf("无日志时不应报错: %v", err)
	}

	mem, _ := store.GetLongTermMemory()
	if mem != "" {
		t.Error("无日志时不应生成长期记忆")
	}
}

func TestDreamingSweep_Run_InvalidDate(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 store 失败: %v", err)
	}

	mockModel := &dreamingMockChatModel{}
	sweep := NewDreamingSweep(store, mockModel)

	// 路径遍历攻击
	err = sweep.Run(context.Background(), "../../etc/passwd")
	if err == nil {
		t.Error("非法日期应报错")
	}

	// 非法格式
	err = sweep.Run(context.Background(), "not-a-date")
	if err == nil {
		t.Error("非法格式应报错")
	}
}

func TestDreamingSweep_Run_EmptyLLMResponse(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 store 失败: %v", err)
	}

	err = store.AppendDailyLog("2026-04-10", "今天学了点东西")
	if err != nil {
		t.Fatalf("写入日志失败: %v", err)
	}

	// 用返回空内容的 mock
	mockModel := &emptyResponseMockChatModel{}
	sweep := NewDreamingSweep(store, mockModel)

	err = sweep.Run(context.Background(), "2026-04-10")
	if err == nil {
		t.Error("LLM 返回空内容时应报错，以保护现有记忆")
	}
}

// emptyResponseMockChatModel LLM 返回空内容
type emptyResponseMockChatModel struct{}

func (m *emptyResponseMockChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	return &schema.Message{Role: schema.Assistant, Content: ""}, nil
}

func (m *emptyResponseMockChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	return nil, nil
}

func (m *emptyResponseMockChatModel) BindTools(tools []*schema.ToolInfo) error {
	return nil
}
