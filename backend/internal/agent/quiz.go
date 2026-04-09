package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const QuizSystemPrompt = `你是 MindFlow 的出题专家。你的职责是根据学生的学习内容和掌握度，自动生成练习题。

出题规则：
1. 根据学生当前学习的主题出 1-3 道题
2. 题目难度要匹配学生水平：
   - 如果学生刚开始学，出基础概念题
   - 如果学生已有一定理解，出应用题或推理题
   - 如果学生掌握良好，出综合分析题
3. 每道题后面标注预期难度（简单/中等/困难）
4. 使用中文
5. 题目格式：

### 题目 1（难度：中等）

[题目内容]

**参考思路**：[不给答案，给解题方向提示]

注意：不要直接给答案，只给思路提示。`

// QuizAgent 出题 Agent
type QuizAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewQuizAgent 创建出题 Agent
func NewQuizAgent(chatModel model.ChatModel) *QuizAgent {
	return &QuizAgent{
		chatModel:    chatModel,
		systemPrompt: QuizSystemPrompt,
	}
}

// GenerateQuiz 生成练习题
func (q *QuizAgent) GenerateQuiz(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(q.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := q.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("出题失败: %w", err)
	}

	return resp.Content, nil
}

// GenerateQuizStream 流式生成练习题
func (q *QuizAgent) GenerateQuizStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(q.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	reader, err := q.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("流式出题失败: %w", err)
	}

	return reader, nil
}
