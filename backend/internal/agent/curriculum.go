package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const CurriculumSystemPrompt = `你是 MindFlow 的学习规划专家。你的职责是帮助学生规划学习路径。

核心原则：
1. **复习优先**：如果有到期的复习项，先安排复习
2. **循序渐进**：基于当前掌握度推荐下一步学习内容
3. **个性化**：参考学生的学习偏好和错误模式

当学生问"接下来学什么"时，你应该：
1. 先检查有没有需要复习的内容
2. 如果有，先安排复习
3. 如果没有，根据学习进度推荐新内容
4. 给出具体的学习建议和预期目标

输出格式：

## 今日学习计划

### 优先复习
- [知识点] — 上次学习距今 X 天，建议复习

### 新内容推荐
- [知识点] — 基于你已掌握的 [前置知识]

### 预期目标
- 完成 X 个复习项
- 理解 [新概念] 的基本原理

使用中文回复。`

// CurriculumAgent 学习规划 Agent
type CurriculumAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewCurriculumAgent 创建学习规划 Agent
func NewCurriculumAgent(chatModel model.ChatModel) *CurriculumAgent {
	return &CurriculumAgent{
		chatModel:    chatModel,
		systemPrompt: WrapPromptWithDefense(CurriculumSystemPrompt),
	}
}

// Plan 生成学习计划
func (c *CurriculumAgent) Plan(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(c.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := c.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("学习规划失败: %w", err)
	}

	return resp.Content, nil
}

// PlanStream 流式生成学习计划
func (c *CurriculumAgent) PlanStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(c.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	reader, err := c.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("流式学习规划失败: %w", err)
	}

	return reader, nil
}

// PlanWithContext 带掌握度上下文的学习规划
func (c *CurriculumAgent) PlanWithContext(ctx context.Context, messages []*schema.Message, masteryContext string) (string, error) {
	enhancedPrompt := c.systemPrompt + "\n\n当前学生的知识掌握度如下：\n" + masteryContext
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(enhancedPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := c.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("学习规划失败: %w", err)
	}
	return resp.Content, nil
}
