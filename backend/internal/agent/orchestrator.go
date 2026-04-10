package agent

import (
	"context"
	"encoding/json"
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
)

// RouteDecision 路由决策
type RouteDecision struct {
	Agent  AgentType `json:"agent"`
	Reason string    `json:"reason"`
}

// Orchestrator 总调度器
type Orchestrator struct {
	chatModel  model.ChatModel
	tutor      *TutorAgent
	diagnostic *DiagnosticAgent
	memAgent   *MemoryAgent
	quiz       *QuizAgent
	review     *ReviewAgent
	curriculum *CurriculumAgent
	content    *ContentAgent
}

// NewOrchestrator 创建调度器
func NewOrchestrator(chatModel model.ChatModel, tutor *TutorAgent) *Orchestrator {
	return &Orchestrator{
		chatModel:  chatModel,
		tutor:      tutor,
		diagnostic: NewDiagnosticAgent(chatModel),
		quiz:       NewQuizAgent(chatModel),
		review:     NewReviewAgent(chatModel),
		curriculum: NewCurriculumAgent(chatModel),
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
	decision, _ := o.Route(ctx, messages)

	var reply string
	var err error

	switch decision.Agent {
	case AgentTypeQuiz:
		reply, err = o.quiz.GenerateQuiz(ctx, messages)
	case AgentTypeCurriculum:
		reply, err = o.curriculum.Plan(ctx, messages)
	case AgentTypeDiagnostic:
		reply, err = o.diagnostic.Diagnose(ctx, messages)
	case AgentTypeContent:
		if o.content != nil {
			reply, err = o.content.Chat(ctx, messages)
		} else {
			reply, err = o.tutor.Chat(ctx, messages)
		}
	default:
		reply, err = o.tutor.Chat(ctx, messages)
	}

	// 记录学习日志
	if err == nil && o.memAgent != nil && len(messages) > 0 {
		lastMsg := messages[len(messages)-1]
		if lastMsg.Role == "user" {
			entry := "**用户**: " + lastMsg.Content + "\n\n**AI**: " + reply
			o.memAgent.RecordLog(entry)
		}
	}

	return reply, err
}

// ChatStream 根据路由决策调度流式对话
func (o *Orchestrator) ChatStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	decision, _ := o.Route(ctx, messages)

	switch decision.Agent {
	case AgentTypeQuiz:
		return o.quiz.GenerateQuizStream(ctx, messages)
	case AgentTypeCurriculum:
		return o.curriculum.PlanStream(ctx, messages)
	case AgentTypeDiagnostic:
		return o.diagnostic.DiagnoseStream(ctx, messages)
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
