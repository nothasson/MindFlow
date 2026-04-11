package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const OrchestratorSystemPrompt = `你是 MindFlow 的教学调度器。你的职责是分析学生的消息，决定应该采取什么教学策略。

根据学生消息的意图，你需要输出一个 JSON 格式的调度决策：

{
  "agent": "tutor",
  "reason": "学生在提问，需要苏格拉底式引导"
}

可用的 agent 类型：
- "tutor": 苏格拉底式教学对话（默认，用于大多数学习场景）
- "diagnostic": 诊断学生回答的错误类型（当学生给出了明确的答案需要评估时）
- "quiz": 出题测验（当学生要求测试或需要检验掌握度时）
- "curriculum": 学习规划（当学生问"接下来学什么"或需要复习建议时）
- "content": 基于资料内容教学（当学生提到资料、文档、上传内容，或问题涉及已上传资料的内容时）
- "review": 复习模式（当学生说"开始复习""复习一下"或需要复习已学过的知识点时）

注意：
- 只输出 JSON，不要输出其他内容
- 如果不确定，默认使用 "tutor"
- reason 字段用中文简要说明原因`

// AgentType Agent 类型
type AgentType string

const (
	AgentTypeTutor      AgentType = "tutor"
	AgentTypeDiagnostic AgentType = "diagnostic"
	AgentTypeQuiz       AgentType = "quiz"
	AgentTypeCurriculum AgentType = "curriculum"
	AgentTypeContent    AgentType = "content"
	AgentTypeReview     AgentType = "review"
)

// RouteDecision 路由决策
type RouteDecision struct {
	Agent  AgentType `json:"agent"`
	Reason string    `json:"reason"`
}

// StuckDetector 卡住检测器 — 跟踪连续错误/正确轮次
type StuckDetector struct {
	wrongCount   int // 连续错误轮次
	correctCount int // 连续正确轮次
	totalCount   int // 总回答轮次（用于计算错误率）
	totalWrong   int // 总错误轮次
}

// OnDiagnostic 根据诊断结果更新计数
func (d *StuckDetector) OnDiagnostic(isCorrect bool) {
	d.totalCount++
	if isCorrect {
		d.correctCount++
		d.wrongCount = 0
	} else {
		d.wrongCount++
		d.totalWrong++
		d.correctCount = 0
	}
}

// ErrorRate 返回历史错误率（0.0 ~ 1.0），无数据时返回 0
func (d *StuckDetector) ErrorRate() float64 {
	if d.totalCount == 0 {
		return 0
	}
	return float64(d.totalWrong) / float64(d.totalCount)
}

// Reset 重置计数
func (d *StuckDetector) Reset() {
	d.wrongCount = 0
	d.correctCount = 0
	d.totalCount = 0
	d.totalWrong = 0
}

// SupportLevel 返回当前应使用的支持力度
func (d *StuckDetector) SupportLevel() string {
	switch {
	case d.wrongCount >= 5:
		return "heavy" // 降低难度，拆分子问题
	case d.wrongCount >= 3:
		return "medium" // 方法性提示
	case d.wrongCount >= 1:
		return "light" // 概念性提示
	case d.correctCount >= 3:
		return "advance" // 提高难度
	default:
		return "normal"
	}
}

// Orchestrator 总调度器
type Orchestrator struct {
	chatModel     model.ChatModel
	tutor         *TutorAgent
	diagnostic    *DiagnosticAgent
	memAgent      *MemoryAgent
	quiz          *QuizAgent
	review        *ReviewAgent
	curriculum    *CurriculumAgent
	content       *ContentAgent
	guard         *PromptGuard
	stuckDetector *StuckDetector
}

// NewOrchestrator 创建调度器
func NewOrchestrator(chatModel model.ChatModel, tutor *TutorAgent) *Orchestrator {
	return &Orchestrator{
		chatModel:     chatModel,
		tutor:         tutor,
		diagnostic:    NewDiagnosticAgent(chatModel),
		quiz:          NewQuizAgent(chatModel),
		review:        NewReviewAgent(chatModel),
		curriculum:    NewCurriculumAgent(chatModel),
		guard:         NewPromptGuard(),
		stuckDetector: &StuckDetector{},
	}
}

// SetMemoryAgent 设置记忆 Agent（可选，依赖 memory store）
func (o *Orchestrator) SetMemoryAgent(memAgent *MemoryAgent) {
	o.memAgent = memAgent
}

// SetContentAgent 设置内容 Agent（可选，依赖 AI 微服务客户端）
func (o *Orchestrator) SetContentAgent(content *ContentAgent) {
	o.content = content
}

// SetTeachingStyle 设置教学风格
func (o *Orchestrator) SetTeachingStyle(style TeachingStyle) {
	o.tutor.SetStyle(style)
}

// SetDifficultyLevel 设置掌握度级别
func (o *Orchestrator) SetDifficultyLevel(level DifficultyLevel) {
	o.tutor.SetLevel(level)
}

// Chat 根据路由决策调度对话（非流式）
func (o *Orchestrator) Chat(ctx context.Context, messages []*schema.Message) (string, error) {
	// 注入防护：检测最后一条用户消息
	if lastUserMsg := extractLastUserMessage(messages); lastUserMsg != "" && o.guard.DetectInjection(lastUserMsg) {
		log.Printf("检测到提示词注入攻击: %s", lastUserMsg[:min(len(lastUserMsg), 50)])
		return o.guard.InjectionRefusalMessage(), nil
	}

	decision, _ := o.Route(ctx, messages)

	var reply string
	var err error

	switch decision.Agent {
	case AgentTypeQuiz:
		reply, err = o.quiz.GenerateQuiz(ctx, messages)
	case AgentTypeCurriculum:
		reply, err = o.curriculum.Plan(ctx, messages)
	case AgentTypeDiagnostic:
		// 先诊断，然后把诊断结果转为自然语言指令交给 Tutor（绝不暴露 JSON）
		diagResult, diagErr := o.diagnostic.Diagnose(ctx, messages)
		if diagErr != nil {
			reply, err = o.tutor.Chat(ctx, messages) // 诊断失败时降级为普通教学
		} else {
			tutorHint := formatDiagnosticForTutor(diagResult)
			augmented := make([]*schema.Message, 0, len(messages)+2)
			augmented = append(augmented, messages...)
			augmented = append(augmented, schema.SystemMessage(tutorHint))
			reply, err = o.tutor.Chat(ctx, augmented)
		}
	case AgentTypeReview:
		reply, err = o.review.Review(ctx, messages)
	case AgentTypeContent:
		if o.content != nil {
			reply, err = o.content.Chat(ctx, messages)
		} else {
			reply, err = o.tutor.Chat(ctx, messages)
		}
	default:
		// 注入脚手架支持力度到 tutor
		if level := o.stuckDetector.SupportLevel(); level != "normal" {
			hint := o.supportLevelHint(level)
			augmented := make([]*schema.Message, 0, len(messages)+1)
			augmented = append(augmented, messages...)
			augmented = append(augmented, schema.SystemMessage(hint))
			reply, err = o.tutor.Chat(ctx, augmented)
		} else {
			reply, err = o.tutor.Chat(ctx, messages)
		}
	}

	// 记录学习日志
	if err == nil && o.memAgent != nil && len(messages) > 0 {
		lastMsg := messages[len(messages)-1]
		if lastMsg.Role == "user" {
			entry := "**用户**: " + lastMsg.Content + "\n\n**AI**: " + reply
			o.memAgent.RecordLog(entry)
		}
	}

	// 每轮对话后自动检测并调整教学难度
	if err == nil {
		o.autoAdjustLevel()
	}

	return reply, err
}

// ChatStream 根据路由决策调度流式对话
func (o *Orchestrator) ChatStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	// 注入防护：检测最后一条用户消息
	if lastUserMsg := extractLastUserMessage(messages); lastUserMsg != "" && o.guard.DetectInjection(lastUserMsg) {
		log.Printf("检测到提示词注入攻击（流式）: %s", lastUserMsg[:min(len(lastUserMsg), 50)])
		// 返回拒绝消息的流式 reader
		refusal := o.guard.InjectionRefusalMessage()
		return schema.StreamReaderFromArray([]*schema.Message{
			{Role: schema.Assistant, Content: refusal},
		}), nil
	}

	decision, _ := o.Route(ctx, messages)

	// 流式对话结束后自动调整教学难度
	defer o.autoAdjustLevel()

	switch decision.Agent {
	case AgentTypeQuiz:
		return o.quiz.GenerateQuizStream(ctx, messages)
	case AgentTypeCurriculum:
		return o.curriculum.PlanStream(ctx, messages)
	case AgentTypeDiagnostic:
		// 先同步诊断，再把结果转为自然语言指令注入 tutor 做流式引导
		diagResult, diagErr := o.diagnostic.Diagnose(ctx, messages)
		if diagErr != nil {
			return o.tutor.ChatStream(ctx, messages)
		}
		tutorHint := formatDiagnosticForTutor(diagResult)
		augmented := make([]*schema.Message, 0, len(messages)+2)
		augmented = append(augmented, messages...)
		augmented = append(augmented, schema.SystemMessage(tutorHint))
		return o.tutor.ChatStream(ctx, augmented)
	case AgentTypeReview:
		return o.review.ReviewStream(ctx, messages)
	case AgentTypeContent:
		if o.content != nil {
			return o.content.ChatStream(ctx, messages)
		}
		return o.tutor.ChatStream(ctx, messages)
	default:
		return o.tutor.ChatStream(ctx, messages)
	}
}

// Route 调用 LLM 分析消息意图并返回路由决策
func (o *Orchestrator) Route(ctx context.Context, messages []*schema.Message) (*RouteDecision, error) {
	if len(messages) == 0 {
		return &RouteDecision{Agent: AgentTypeTutor, Reason: "无消息，默认教学"}, nil
	}

	// 构建路由 prompt，只发最后一条用户消息给 LLM 判断
	lastMsg := messages[len(messages)-1]

	// 动态构建可用 agent 列表（content 仅在 aiClient 可用时列出）
	prompt := o.buildRoutePrompt()

	routeMessages := []*schema.Message{
		schema.SystemMessage(prompt),
		schema.UserMessage(lastMsg.Content),
	}

	resp, err := o.chatModel.Generate(ctx, routeMessages)
	if err != nil {
		log.Printf("路由 LLM 调用失败，回退到 tutor: %v", err)
		return &RouteDecision{Agent: AgentTypeTutor, Reason: "LLM 路由失败，回退默认"}, nil
	}

	// 解析 JSON 决策
	var decision RouteDecision
	cleaned := cleanJSON(resp.Content)
	if err := json.Unmarshal([]byte(cleaned), &decision); err != nil {
		log.Printf("路由决策解析失败，回退到 tutor: %s", resp.Content)
		return &RouteDecision{Agent: AgentTypeTutor, Reason: "决策解析失败，回退默认"}, nil
	}

	// 校验：content agent 不可用时回退
	if decision.Agent == AgentTypeContent && o.content == nil {
		decision.Agent = AgentTypeTutor
		decision.Reason += "（content agent 不可用，回退到 tutor）"
	}

	return &decision, nil
}

// buildRoutePrompt 动态构建路由 prompt，只列出实际可用的 agent
func (o *Orchestrator) buildRoutePrompt() string {
	prompt := OrchestratorSystemPrompt
	if o.content == nil {
		// 从 prompt 中移除 content agent 的描述，避免 LLM 路由到不可用的 agent
		prompt = strings.Replace(prompt,
			"- \"content\": 基于资料内容教学（当学生提到资料、文档、上传内容，或问题涉及已上传资料的内容时）\n", "", 1)
	}
	return prompt
}

// cleanJSON 从 LLM 响应中提取 JSON（处理可能的 markdown 包裹）
func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	// 去除 ```json ... ``` 包裹
	if strings.HasPrefix(s, "```") {
		if idx := strings.Index(s[3:], "\n"); idx >= 0 {
			s = s[3+idx+1:]
		}
		if idx := strings.LastIndex(s, "```"); idx >= 0 {
			s = s[:idx]
		}
	}
	return strings.TrimSpace(s)
}

// GetAgent 根据类型返回对应 Agent（当前只有 tutor）
func (o *Orchestrator) GetAgent(agentType AgentType) interface{} {
	switch agentType {
	case AgentTypeTutor:
		return o.tutor
	default:
		return o.tutor
	}
}

// RecordMemory 记录一条学习日志（供 handler 流式结束后调用）
func (o *Orchestrator) RecordMemory(userMsg, assistantReply string) {
	if o.memAgent == nil || userMsg == "" {
		return
	}
	entry := "**用户**: " + userMsg + "\n\n**AI**: " + assistantReply
	o.memAgent.RecordLog(entry)
}

// GetKnowledgeRepo 返回知识图谱 repo（供 handler 更新掌握度）
func (o *Orchestrator) GetKnowledgeRepo() interface{} {
	// Orchestrator 不直接持有 repo，由 handler 层处理
	return nil
}

// GetStuckDetector 返回卡住检测器（供外部更新状态）
func (o *Orchestrator) GetStuckDetector() *StuckDetector {
	return o.stuckDetector
}

// DetectTeachingLevel 根据最近对话信号自动调整教学难度
// 基于错误率和连续正确/错误次数综合判断
func (o *Orchestrator) DetectTeachingLevel() DifficultyLevel {
	detector := o.stuckDetector
	errorRate := detector.ErrorRate()

	switch {
	case errorRate > 0.6:
		// 错误率超过 60%，降为初学者模式
		return LevelBeginner
	case errorRate < 0.2 && detector.correctCount >= 3:
		// 错误率低于 20% 且连续正确 >= 3，提升为专家模式
		return LevelExpert
	default:
		return LevelAdvanced
	}
}

// autoAdjustLevel 根据对话表现自动调整教学难度并应用到 tutor
func (o *Orchestrator) autoAdjustLevel() {
	// 至少有 3 轮对话数据才开始自动调整
	if o.stuckDetector.totalCount < 3 {
		return
	}
	newLevel := o.DetectTeachingLevel()
	if newLevel != o.tutor.GetLevel() {
		o.tutor.SetLevel(newLevel)
		log.Printf("教学难度自动调整为: %s (错误率: %.1f%%, 连续正确: %d, 连续错误: %d)",
			newLevel, o.stuckDetector.ErrorRate()*100,
			o.stuckDetector.correctCount, o.stuckDetector.wrongCount)
	}
}

// supportLevelHint 根据支持力度生成注入 Prompt 的提示
func (o *Orchestrator) supportLevelHint(level string) string {
	switch level {
	case "light":
		return "[系统提示] 学生刚才回答有误，请使用 CARA 纠错框架，给一个概念性提示引导。"
	case "medium":
		return "[系统提示] 学生已连续卡住多轮，请给出方法性提示（具体的解题步骤方向），但仍不要直接给答案。"
	case "heavy":
		return "[系统提示] 学生已严重卡住，请降低难度，将问题拆分为更简单的子问题，必要时补充前置知识。"
	case "advance":
		return "[系统提示] 学生表现出色，连续回答正确，请提高难度或推进到更深层的概念。"
	default:
		return ""
	}
}

// formatDiagnosticForTutor 把诊断 JSON 转为自然语言教学指令，
// 避免 LLM 直接把 JSON 回显给学生。
func formatDiagnosticForTutor(rawDiag string) string {
	result, err := ParseDiagnosticResult(rawDiag)
	if err != nil {
		log.Printf("诊断结果解析失败: %v，原始数据: %s", err, rawDiag[:min(len(rawDiag), 100)])
		return "[内部教学指令] 学生的回答需要引导改进。请用苏格拉底式提问帮助学生思考，用自然的中文对话回复。"
	}

	var b strings.Builder
	b.WriteString("[内部教学指令 - 严禁将以下内容原样展示给学生，你必须用自然对话回复]\n\n")

	switch result.Correctness {
	case "correct":
		b.WriteString("学生回答正确。请肯定学生的思路，然后用追问推进到更深层的理解。\n")
	case "partial":
		b.WriteString("学生回答部分正确。请先肯定正确的部分，然后用引导性问题帮助学生发现不足之处。\n")
	case "wrong":
		b.WriteString("学生回答有误。请不要直说「错了」，用反例或引导性问题帮助学生自己发现问题。\n")
	default:
		b.WriteString("请根据学生的回答给予引导。\n")
	}

	if result.PrimaryError.Type != "none" && result.PrimaryError.Type != "" {
		b.WriteString(fmt.Sprintf("主要问题：%s\n", result.PrimaryError.Description))
	}

	if result.MetacognitiveError.Type != "none" && result.MetacognitiveError.Type != "" {
		b.WriteString(fmt.Sprintf("元认知问题：%s\n", result.MetacognitiveError.Description))
	}

	if result.Analysis != "" {
		b.WriteString(fmt.Sprintf("分析：%s\n", result.Analysis))
	}

	if result.GuidanceStrategy != "" {
		b.WriteString(fmt.Sprintf("建议引导方式：%s\n", result.GuidanceStrategy))
	}

	if result.PrerequisiteGap != nil && *result.PrerequisiteGap != "" {
		b.WriteString(fmt.Sprintf("学生可能缺少前置知识：%s，可以先补充这部分。\n", *result.PrerequisiteGap))
	}

	b.WriteString("\n请用自然的中文对话回复学生，语气鼓励正面，以一个引导性问题结尾。绝对不要输出 JSON 或提及诊断结果。")
	return b.String()
}
