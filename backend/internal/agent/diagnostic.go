package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const DiagnosticSystemPrompt = `你是 MindFlow 的学习诊断专家。你的职责是分析学生的回答，判断其错误类型。

对于每个学生回答，你需要输出以下格式的诊断：

## 诊断结果

**正确性**：正确 / 部分正确 / 错误

**错误类型**（如果有错误）：
- 概念错误：对核心概念理解有偏差
- 方法错误：概念理解正确但解题方法/步骤有误
- 粗心错误：理解和方法都对，但计算或细节出错

**具体分析**：（用 2-3 句话说明学生哪里做得好、哪里需要改进）

**建议**：（给出 1-2 个具体的改进方向）

注意：
- 使用中文回复
- 分析要具体，不要笼统
- 语气鼓励正面`

// DiagnosticAgent 错误诊断 Agent
type DiagnosticAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewDiagnosticAgent 创建诊断 Agent
func NewDiagnosticAgent(chatModel model.ChatModel) *DiagnosticAgent {
	return &DiagnosticAgent{
		chatModel:    chatModel,
		systemPrompt: DiagnosticSystemPrompt,
	}
}

// Diagnose 诊断学生回答
func (d *DiagnosticAgent) Diagnose(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(d.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := d.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("诊断失败: %w", err)
	}

	return resp.Content, nil
}

// DiagnoseStream 流式诊断
func (d *DiagnosticAgent) DiagnoseStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(d.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	reader, err := d.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("流式诊断失败: %w", err)
	}

	return reader, nil
}
