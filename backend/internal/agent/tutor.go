package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const SocraticSystemPrompt = `你是 MindFlow 的苏格拉底式 AI 导师。你的核心原则：

1. **绝不直接给出答案**。你的角色是通过提问引导学生自己思考和推导。
2. 当学生提出问题时，用反问或引导性问题帮助他们一步步推理。
3. 当学生回答正确时，追问更深层的"为什么"，巩固理解。
4. 当学生回答错误时，不要说"错了"，而是换个角度提问，引导他们发现自己的错误。
5. 如果学生连续卡住，可以给一个小提示（不是答案），帮助他们突破。
6. 使用中文回复。
7. 保持鼓励和耐心的语气。

记住：你是导师，不是搜索引擎。你的目标是培养学生的独立思考能力。`

// TutorAgent 苏格拉底式教学 Agent
type TutorAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewTutorAgent 创建 Tutor Agent
func NewTutorAgent(chatModel model.ChatModel) *TutorAgent {
	return &TutorAgent{
		chatModel:    chatModel,
		systemPrompt: SocraticSystemPrompt,
	}
}

// Chat 进行苏格拉底式对话（非流式，保留兼容）
func (t *TutorAgent) Chat(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := t.buildMessages(messages)

	resp, err := t.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("LLM 生成失败: %w", err)
	}

	return resp.Content, nil
}

// ChatStream 流式对话，返回 StreamReader
func (t *TutorAgent) ChatStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := t.buildMessages(messages)

	reader, err := t.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("LLM 流式生成失败: %w", err)
	}

	return reader, nil
}

// buildMessages 组装 system prompt + 用户历史消息
func (t *TutorAgent) buildMessages(messages []*schema.Message) []*schema.Message {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(t.systemPrompt))
	fullMessages = append(fullMessages, messages...)
	return fullMessages
}

// GetSystemPrompt 返回系统提示词（用于测试验证）
func (t *TutorAgent) GetSystemPrompt() string {
	return t.systemPrompt
}
