package agent

import (
	"context"
	"encoding/json"
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
		systemPrompt: WrapPromptWithDefense(QuizSystemPrompt),
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

const EvaluateSystemPrompt = `你是答案评分员。请评估学生对题目的回答质量，并给出简要解析。

评分标准（0-5 分）：
- 5 分：完全正确，表述清晰
- 4 分：基本正确，有小瑕疵
- 3 分：部分正确，核心概念理解但有错误
- 2 分：大部分错误，只答对了边缘内容
- 1 分：几乎全错
- 0 分：完全错误或没有实质内容

请严格按以下 JSON 格式输出，不要输出其他内容：
{"score": 数字, "explanation": "2-3句话的解析，说明答对了什么、答错了什么、正确答案是什么方向"}

使用中文。`

// EvaluateResult 评分结果
type EvaluateResult struct {
	Score       int    `json:"score"`
	Explanation string `json:"explanation"`
}

// EvaluateAnswer 评估学生回答质量，返回分数和解析
func (q *QuizAgent) EvaluateAnswer(ctx context.Context, question, answer string) (int, string, error) {
	messages := []*schema.Message{
		schema.SystemMessage(EvaluateSystemPrompt),
		schema.UserMessage("题目：" + question + "\n\n学生回答：" + answer),
	}

	resp, err := q.chatModel.Generate(ctx, messages)
	if err != nil {
		return 3, "", fmt.Errorf("评分失败: %w", err)
	}

	// 尝试解析 JSON
	content := resp.Content
	// 提取 JSON 部分（兼容 LLM 可能加上前后缀的情况）
	start := -1
	end := -1
	for i, ch := range content {
		if ch == '{' && start == -1 {
			start = i
		}
		if ch == '}' {
			end = i + 1
		}
	}

	if start >= 0 && end > start {
		jsonStr := content[start:end]
		var result EvaluateResult
		if jsonErr := json.Unmarshal([]byte(jsonStr), &result); jsonErr == nil {
			if result.Score >= 0 && result.Score <= 5 {
				return result.Score, result.Explanation, nil
			}
		}
	}

	// 降级：提取数字作为分数，整段文本作为解析
	for _, ch := range content {
		if ch >= '0' && ch <= '5' {
			return int(ch - '0'), content, nil
		}
	}
	return 3, content, nil
}
