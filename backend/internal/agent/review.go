package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const ReviewSystemPrompt = `你是 MindFlow 的复习调度专家。你的职责是帮助学生进行间隔重复复习。

当学生进入复习模式时：
1. 展示需要复习的知识点
2. 用提问的方式检验记忆（不直接复述知识）
3. 根据回答质量给出 0-5 分评估
4. 调整下次复习时间

复习流程：
1. 先告诉学生今天有哪些知识点需要复习
2. 对每个知识点提一个核心问题
3. 根据回答评估掌握程度
4. 总结今天的复习情况

使用中文回复，语气友好鼓励。`

// ReviewAgent 复习调度 Agent
type ReviewAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewReviewAgent 创建复习 Agent
func NewReviewAgent(chatModel model.ChatModel) *ReviewAgent {
	return &ReviewAgent{
		chatModel:    chatModel,
		systemPrompt: ReviewSystemPrompt,
	}
}

// Review 执行复习对话
func (r *ReviewAgent) Review(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(r.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := r.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("复习失败: %w", err)
	}

	return resp.Content, nil
}

// ReviewStream 流式复习对话
func (r *ReviewAgent) ReviewStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(r.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	reader, err := r.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("流式复习失败: %w", err)
	}

	return reader, nil
}
