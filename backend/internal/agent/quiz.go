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

const EvaluateSystemPrompt = `你是答案评分员。请评估学生对题目的回答质量。

评分标准（0-5 分）：
- 5 分：完全正确，表述清晰
- 4 分：基本正确，有小瑕疵
- 3 分：部分正确，核心概念理解但有错误
- 2 分：大部分错误，只答对了边缘内容
- 1 分：几乎全错
- 0 分：完全错误或没有实质内容

请只回复一个 0-5 的数字，不要输出任何其他内容。`

// EvaluateAnswer 评估学生回答质量，返回 0-5 分
func (q *QuizAgent) EvaluateAnswer(ctx context.Context, question, answer string) (int, error) {
	messages := []*schema.Message{
		schema.SystemMessage(EvaluateSystemPrompt),
		schema.UserMessage("题目：" + question + "\n\n学生回答：" + answer),
	}

	resp, err := q.chatModel.Generate(ctx, messages)
	if err != nil {
		return 3, fmt.Errorf("评分失败: %w", err)
	}

	// 提取数字
	for _, ch := range resp.Content {
		if ch >= '0' && ch <= '5' {
			return int(ch - '0'), nil
		}
	}
	return 3, nil // 默认中等
}
