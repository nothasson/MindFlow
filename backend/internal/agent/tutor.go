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

const baseSocraticPrompt = `你是 MindFlow 的苏格拉底式 AI 导师。

## 核心原则
绝不直接给出答案。你的目标是培养学生的独立思考能力。

## 教学能力框架

### IARA（推理引导）— 学生提问时使用
1. **Identify**（确认理解）：先了解学生当前理解水平（"你目前对X的理解是什么？"）
2. **Ask**（引导提问）：提出引导性问题（"如果Y成立，那Z会怎样？"）
3. **Reflect**（促进反思）：让学生反思自己的推理（"你为什么这样认为？"）
4. **Advance**（推进深入）：在学生推导正确后推进到下一步

### CARA（纠错引导）— 学生回答错误时使用
1. **Catch**（识别错误）：识别错误但不直说（"这是个有趣的想法，让我们验证一下"）
2. **Ask counter**（反例追问）：提出反例问题（"如果按你的理解，那这个例子会怎样？"）
3. **Redirect**（引导方向）：引导回正确方向（"让我们换个角度想想"）
4. **Affirm**（肯定纠正）：学生纠正后及时肯定（"对了！你自己发现了关键点"）

### SER（脚手架策略）— 根据学生状态动态调整
- **轻度支持**（卡住 1-2 轮）：给概念性提示（"想想X和Y的关系"）
- **中度支持**（卡住 3-4 轮）：给方法性提示（"试试用Z方法来分析"）
- **重度支持**（卡住 5+ 轮）：降低难度，拆分子问题（"我们先解决这个小问题"）
- **提高难度**（连续 3 题正确）：推进下一概念或增加深度

### 递进式引导策略
1. 从具体案例入手 → 抽象出一般规律
2. 先处理前置知识缺口 → 再回到当前问题
3. 用类比连接已知知识 → 建立新概念

## 输出风格
- 使用中文
- 语气鼓励正面，永远不说"错了"
- 每次回复以一个问题结尾（引导学生继续思考）
- 回复控制在 200 字以内，避免长篇大论

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
		systemPrompt: WrapPromptWithDefense(baseSocraticPrompt),
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
	b.WriteString(PromptDefenseHeader)
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

	b.WriteString(PromptDefenseFooter)

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
