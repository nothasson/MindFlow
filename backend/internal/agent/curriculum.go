package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const CurriculumSystemPrompt = `你是 MindFlow 的学习规划专家，同时也是一个亲切的苏格拉底式导师。

当学生问"想学什么"或"接下来学什么"时，你应该用**自然的对话语气**回复，而不是列清单。

核心原则：
1. 像朋友聊天一样，先回应学生的兴趣
2. 如果有需要复习的内容，自然地提一句
3. 给出学习建议时，解释为什么这样安排
4. 用引导性问题结尾，了解学生的基础和偏好

注意：
- 用自然的中文对话，不要用"今日学习计划""优先复习""新内容推荐""预期目标"这种公文格式
- 不要列编号清单，用流畅的段落表达
- 语气鼓励、有温度
- 以一个问题结尾，引导学生思考或选择方向`

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

// BriefingSystemPrompt 晨间简报专用 Prompt
const BriefingSystemPrompt = `你是 MindFlow 的学习规划专家。请根据提供的学习数据，生成今日学习建议。

你必须严格按照以下 JSON 格式输出，不要输出任何其他内容（不要用 markdown 代码块包裹）：
{
  "greeting": "一句个性化的问候语，可以结合学习情况",
  "review_items": [{"concept": "需要复习的概念", "reason": "为什么需要复习", "est_minutes": 5}],
  "new_items": [{"concept": "建议新学的概念", "reason": "为什么建议学习", "est_minutes": 15}],
  "quiz_suggestion": {"concept": "建议测验的概念", "reason": "为什么建议测验", "est_minutes": 10}
}

规则：
1. review_items 基于到期复习项和薄弱知识点，最多 5 个
2. new_items 基于学习进度推荐下一步内容，最多 3 个
3. quiz_suggestion 选择最需要巩固的一个概念
4. 如果某个类别没有数据，对应字段使用空数组或 null
5. est_minutes 是预估学习时间（分钟）
6. 使用中文`

// GenerateBriefing 生成今日学习简报
func (c *CurriculumAgent) GenerateBriefing(ctx context.Context, learningContext string) (string, error) {
	messages := []*schema.Message{
		schema.SystemMessage(WrapPromptWithDefense(BriefingSystemPrompt)),
		schema.UserMessage("以下是我当前的学习数据，请生成今日学习建议：\n\n" + learningContext),
	}

	resp, err := c.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("生成晨间简报失败: %w", err)
	}

	return resp.Content, nil
}
