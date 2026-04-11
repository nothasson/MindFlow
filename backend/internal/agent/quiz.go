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
5. 题目格式（必须严格遵守）：

### 题目 1（难度：中等）

[题目内容]

**参考思路**：[给出解题方向的提示]

**正确答案**：[给出完整的正确答案]

注意：参考思路是引导学生思考的提示，正确答案是完整的标准答案。两者都必须给出。`

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

// BloomLevel 根据 confidence 返回 Bloom 认知层级和对应的出题要求
func BloomLevel(confidence float64) (string, string) {
	switch {
	case confidence < 0.3:
		return "记忆（remember）", "出定义识别类题目：要求学生回忆定义、识别概念、列举要素"
	case confidence < 0.5:
		return "理解（understand）", "出理解解释类题目：要求学生用自己的话解释概念、比较异同、举例说明"
	case confidence < 0.7:
		return "应用（apply）", "出实际应用类题目：要求学生将概念应用于实际问题求解、计算或操作"
	case confidence < 0.85:
		return "分析（analyze）", "出分析推理类题目：要求学生分析原因、推理因果关系、归纳规律"
	case confidence < 0.95:
		return "评价（evaluate）", "出评价判断类题目：要求学生对方案进行评估、判断优劣、论证观点"
	default:
		return "创造（create）", "出创造设计类题目：要求学生综合知识设计方案、提出新的解决思路、创造新应用"
	}
}

// GenerateQuizWithBloom 根据学生 confidence 自动匹配 Bloom 认知层级出题
func (q *QuizAgent) GenerateQuizWithBloom(ctx context.Context, concept string, confidence float64) (string, error) {
	bloomLevel, bloomDesc := BloomLevel(confidence)

	bloomPrompt := fmt.Sprintf(`你是 MindFlow 的出题专家。请根据 Bloom 认知分类法的指定层级，为学生出题。

当前知识点：%s
学生掌握度：%.0f%%
Bloom 认知层级：%s

出题要求：
1. %s
2. 出 1-3 道题，所有题目必须符合上述认知层级
3. 使用中文
4. 题目格式：

### 题目 1（Bloom 层级：%s）

[题目内容]

**参考思路**：[不给答案，给解题方向提示]

注意：不要直接给答案，只给思路提示。`, concept, confidence*100, bloomLevel, bloomDesc, bloomLevel)

	messages := []*schema.Message{
		schema.SystemMessage(WrapPromptWithDefense(bloomPrompt)),
		schema.UserMessage("请针对「" + concept + "」出题"),
	}

	resp, err := q.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("Bloom 分层出题失败: %w", err)
	}

	return resp.Content, nil
}

// GenerateConversationalQuiz 对话式考察模式：多轮追问深入考察学生理解
func (q *QuizAgent) GenerateConversationalQuiz(ctx context.Context, concept string, round int, history string) (string, error) {
	conversationalPrompt := fmt.Sprintf(`你是考察导师。通过多轮对话深入考察学生对「%s」的理解。

当前是第 %d 轮对话。你的策略：
1. 先从开放性问题入手，了解学生当前理解水平
2. 根据回答质量决定是追问、提出反例还是转换角度
3. 当你认为已经充分了解学生的掌握程度时（通常 3-6 轮），主动结束考察

## 结束考察规则
当你觉得考察已经充分，在回复末尾输出综合评估，格式必须包含：
[考察完成]
评分：X/5
优点：...
不足：...
建议：...

只有你觉得考察充分时才输出 [考察完成]。如果学生回答很简短或敷衍，可以继续追问。

对话历史：
%s

请根据对话历史给出你的回复。使用中文。`, concept, round, history)

	messages := []*schema.Message{
		schema.SystemMessage(WrapPromptWithDefense(conversationalPrompt)),
		schema.UserMessage("请继续对话考察"),
	}

	resp, err := q.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("对话考察失败: %w", err)
	}

	return resp.Content, nil
}

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
