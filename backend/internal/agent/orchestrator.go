package agent

import (
	"context"

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

当前阶段只有 tutor 可用，其他 agent 尚未实现，统一路由到 tutor。

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

// Chat 根据路由决策调度对话（非流式）
func (o *Orchestrator) Chat(ctx context.Context, messages []*schema.Message) (string, error) {
	decision, _ := o.Route(ctx, messages)

	switch decision.Agent {
	case AgentTypeQuiz:
		return o.quiz.GenerateQuiz(ctx, messages)
	case AgentTypeCurriculum:
		return o.curriculum.Plan(ctx, messages)
	case AgentTypeDiagnostic:
		return o.diagnostic.Diagnose(ctx, messages)
	default:
		return o.tutor.Chat(ctx, messages)
	}
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
	default:
		return o.tutor.ChatStream(ctx, messages)
	}
}

// Route 分析消息并返回路由决策（预留，当前不调用 LLM 路由）
func (o *Orchestrator) Route(ctx context.Context, messages []*schema.Message) (*RouteDecision, error) {
	if len(messages) == 0 {
		return &RouteDecision{Agent: AgentTypeTutor, Reason: "无消息，默认教学"}, nil
	}

	lastMsg := messages[len(messages)-1]

	// 简单规则路由（不消耗 LLM token）
	switch {
	case containsKeyword(lastMsg.Content, "出题", "测试", "考考我", "检验"):
		return &RouteDecision{Agent: AgentTypeQuiz, Reason: "学生请求出题测验"}, nil
	case containsKeyword(lastMsg.Content, "接下来学什么", "复习", "学习计划", "建议学"):
		return &RouteDecision{Agent: AgentTypeCurriculum, Reason: "学生请求学习规划"}, nil
	default:
		return &RouteDecision{Agent: AgentTypeTutor, Reason: "默认苏格拉底式教学"}, nil
	}
}

// GetAgent 根据类型返回对应 Agent（当前只有 tutor）
func (o *Orchestrator) GetAgent(agentType AgentType) interface{} {
	switch agentType {
	case AgentTypeTutor:
		return o.tutor
	default:
		// 其他 Agent 尚未实现，回退到 tutor
		return o.tutor
	}
}

func containsKeyword(text string, keywords ...string) bool {
	for _, kw := range keywords {
		if len(text) >= len(kw) {
			for i := 0; i <= len(text)-len(kw); i++ {
				if text[i:i+len(kw)] == kw {
					return true
				}
			}
		}
	}
	return false
}

// containsKeyword 的更安全版本，使用 strings 包
func init() {
	// 预留：后续可在此注册新 Agent
}
