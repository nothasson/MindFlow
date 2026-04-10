package agent

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// TeachingStyle 教学风格
type TeachingStyle string

const (
	StyleSocratic  TeachingStyle = "socratic"   // 苏格拉底追问
	StyleLecture   TeachingStyle = "lecture"     // 课堂讲解
	StyleAnalogy   TeachingStyle = "analogy"     // 生活化比喻
)

// DifficultyLevel 掌握度分级
type DifficultyLevel string

const (
	LevelBeginner DifficultyLevel = "beginner"
	LevelAdvanced DifficultyLevel = "advanced"
	LevelExpert   DifficultyLevel = "expert"
)

const baseSocraticPrompt = `你是 MindFlow 的苏格拉底式 AI 导师。你的核心原则：

1. **绝不直接给出答案**。你的角色是通过提问引导学生自己思考和推导。
2. 当学生提出问题时，用反问或引导性问题帮助他们一步步推理。
3. 当学生回答正确时，追问更深层的"为什么"，巩固理解。
4. 当学生回答错误时，不要说"错了"，而是换个角度提问，引导他们发现自己的错误。
5. 如果学生连续卡住，可以给一个小提示（不是答案），帮助他们突破。
6. 使用中文回复。
7. 保持鼓励和耐心的语气。

记住：你是导师，不是搜索引擎。你的目标是培养学生的独立思考能力。`

const lectureStyleAddon = `

**教学风格：课堂讲解**
- 先系统讲解概念，再提问确认理解
- 讲解时使用清晰的结构（要点、步骤、总结）
- 适当使用公式和定义
- 讲解完一个知识点后，用一个简单问题检验理解`

const analogyStyleAddon = `

**教学风格：生活化比喻**
- 用日常生活中的事物来类比抽象概念
- 先给比喻，再引导学生思考"这个比喻哪里对应了概念的什么部分"
- 语言通俗易懂，避免术语堆砌
- 每个概念至少给一个形象的比喻`

const beginnerAddon = `

**学生水平：初学者**
- 使用简单、通俗的语言
- 每次只推进一个概念
- 多给鼓励，降低挫败感
- 如果学生卡住 1 轮就给提示`

const advancedAddon = `

**学生水平：进阶者**
- 可以使用专业术语
- 鼓励学生做更深层的推理
- 追问"为什么"和"如果...会怎样"
- 适当增加难度`

const expertAddon = `

**学生水平：专家**
- 直接讨论边界情况和高级话题
- 鼓励学生质疑和反驳
- 用开放性问题激发创造性思考
- 不需要降低难度`

// TutorAgent 苏格拉底式教学 Agent
type TutorAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
	style        TeachingStyle
	level        DifficultyLevel
}

// NewTutorAgent 创建 Tutor Agent
func NewTutorAgent(chatModel model.ChatModel) *TutorAgent {
	return &TutorAgent{
		chatModel:    chatModel,
		systemPrompt: baseSocraticPrompt,
		style:        StyleSocratic,
		level:        LevelBeginner,
	}
}

// SetStyle 设置教学风格
func (t *TutorAgent) SetStyle(style TeachingStyle) {
	t.style = style
	t.systemPrompt = t.buildPrompt()
}

// SetLevel 设置掌握度级别
func (t *TutorAgent) SetLevel(level DifficultyLevel) {
	t.level = level
	t.systemPrompt = t.buildPrompt()
}

// buildPrompt 根据风格和级别构建 system prompt
func (t *TutorAgent) buildPrompt() string {
	var b strings.Builder
	b.WriteString(baseSocraticPrompt)

	switch t.style {
	case StyleLecture:
		b.WriteString(lectureStyleAddon)
	case StyleAnalogy:
		b.WriteString(analogyStyleAddon)
	default:
		// socratic 不需要额外 addon
	}

	switch t.level {
	case LevelAdvanced:
		b.WriteString(advancedAddon)
	case LevelExpert:
		b.WriteString(expertAddon)
	default:
		b.WriteString(beginnerAddon)
	}

	return b.String()
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

// GetStyle 返回当前教学风格
func (t *TutorAgent) GetStyle() TeachingStyle {
	return t.style
}

// GetLevel 返回当前掌握度级别
func (t *TutorAgent) GetLevel() DifficultyLevel {
	return t.level
}
