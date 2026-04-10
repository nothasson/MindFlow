package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const DiagnosticSystemPrompt = `你是 MindFlow 的学习诊断专家。分析学生回答，输出 **严格 JSON 格式** 的诊断结果。

## 错误分类体系

### 基础错误（5 种）
| 类型 | 代码 | 定义 | 示例 |
|------|------|------|------|
| 知识遗漏 | knowledge_gap | 缺少必要的前置知识 | 不知道求导法则就尝试求导 |
| 概念混淆 | concept_confusion | 混淆了相似但不同的概念 | 混淆速度和加速度 |
| 概念错误 | concept_error | 对概念有根本性误解 | 认为面积可以是负数 |
| 方法错误 | method_error | 概念正确但解法/步骤有误 | 解方程时两边同除以零 |
| 计算错误 | calculation_error | 理解和方法都对但算错了 | 3×7=24 |

### 元认知错误（3 种）
| 类型 | 代码 | 定义 |
|------|------|------|
| 过度自信 | overconfidence | 对错误答案非常确定 |
| 策略错误 | strategy_error | 选择了不适合的解题策略 |
| 表述不清 | unclear_expression | 思路可能正确但表达混乱 |

## 输出格式（严格 JSON，不要输出 JSON 以外的任何内容）

{
  "correctness": "correct 或 partial 或 wrong",
  "primary_error": {
    "type": "错误代码（如 knowledge_gap），正确时填 none",
    "description": "具体哪里错了的中文描述"
  },
  "metacognitive_error": {
    "type": "元认知错误代码，没有则填 none",
    "description": "元认知层面的问题描述"
  },
  "analysis": "2-3 句具体分析，说明学生哪里做得好、哪里需要改进",
  "guidance_strategy": "建议的引导动作：用反例提问 / 补充前置知识 / 换角度引导 / 降低难度 / 深入追问",
  "prerequisite_gap": "如有前置知识缺口填概念名称，否则填 null"
}

注意：
- 使用中文填写描述字段，代码字段用英文
- 分析要具体，不要笼统
- 语气鼓励正面
- 即使学生回答正确，也要分析得有深度`

// DiagnosticResult 结构化诊断结果
type DiagnosticResult struct {
	Correctness string `json:"correctness"` // correct / partial / wrong
	PrimaryError struct {
		Type        string `json:"type"`
		Description string `json:"description"`
	} `json:"primary_error"`
	MetacognitiveError struct {
		Type        string `json:"type"`
		Description string `json:"description"`
	} `json:"metacognitive_error"`
	Analysis         string  `json:"analysis"`
	GuidanceStrategy string  `json:"guidance_strategy"`
	PrerequisiteGap  *string `json:"prerequisite_gap"`
}

// DiagnosticAgent 错误诊断 Agent
type DiagnosticAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewDiagnosticAgent 创建诊断 Agent
func NewDiagnosticAgent(chatModel model.ChatModel) *DiagnosticAgent {
	return &DiagnosticAgent{
		chatModel:    chatModel,
		systemPrompt: WrapPromptWithDefense(DiagnosticSystemPrompt),
	}
}

// Diagnose 诊断学生回答，返回原始文本（兼容流式场景）
func (d *DiagnosticAgent) Diagnose(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(d.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := d.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("诊断失败: %w", err)
	}

	return resp.Content, nil
}

// DiagnoseStructured 诊断并返回结构化结果
func (d *DiagnosticAgent) DiagnoseStructured(ctx context.Context, messages []*schema.Message) (*DiagnosticResult, string, error) {
	raw, err := d.Diagnose(ctx, messages)
	if err != nil {
		return nil, "", err
	}

	result, parseErr := ParseDiagnosticResult(raw)
	if parseErr != nil {
		log.Printf("诊断结果 JSON 解析失败，返回原始文本: %v", parseErr)
		return nil, raw, nil
	}

	return result, raw, nil
}

// DiagnoseStream 流式诊断
func (d *DiagnosticAgent) DiagnoseStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(d.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	reader, err := d.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("流式诊断失败: %w", err)
	}

	return reader, nil
}

// ParseDiagnosticResult 从 LLM 输出中解析结构化诊断结果
func ParseDiagnosticResult(raw string) (*DiagnosticResult, error) {
	cleaned := cleanJSON(raw)
	var result DiagnosticResult
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("JSON 解析失败: %w", err)
	}
	return &result, nil
}
