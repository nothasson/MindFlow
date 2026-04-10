package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const VariantQuizPrompt = `你是变式题生成专家。根据学生的错题和错误类型，生成针对性变式题。

## 6 种变式类型
| 类型 | 代码 | 适用场景 |
|------|------|---------|
| 参数变换 | parameter | 原题换数字/参数 |
| 情境变换 | context | 换一个应用场景 |
| 角度变换 | angle | 正向→反向，或换切入角度 |
| 反向出题 | reverse | 已知结果求条件 |
| 简化变式 | simplify | 降低难度，减少干扰 |
| 综合变式 | comprehensive | 组合多知识点 |

## 错误类型 → 推荐变式类型
- knowledge_gap → simplify
- concept_confusion → reverse
- concept_error → context
- method_error → angle
- calculation_error → parameter
- overconfidence → comprehensive
- strategy_error → angle
- unclear_expression → simplify

## 输出格式（严格 JSON，不要输出其他内容）
{
  "variant_type": "变式类型代码",
  "question": "完整的变式题目",
  "hint": "解题提示（不含答案）",
  "difficulty": "easy/medium/hard"
}

根据输入的原题、学生错误答案、错误类型，生成 1 道最适合的变式题。使用中文。`

// VariantQuizAgent 变式题生成 Agent
type VariantQuizAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewVariantQuizAgent 创建变式题 Agent
func NewVariantQuizAgent(chatModel model.ChatModel) *VariantQuizAgent {
	return &VariantQuizAgent{
		chatModel:    chatModel,
		systemPrompt: WrapPromptWithDefense(VariantQuizPrompt),
	}
}

// Generate 生成变式题
func (v *VariantQuizAgent) Generate(ctx context.Context, concept, question, userAnswer, errorType string) (string, error) {
	userMsg := fmt.Sprintf("概念：%s\n错误类型：%s\n\n原题：%s\n\n学生错误答案：%s", concept, errorType, question, userAnswer)

	messages := []*schema.Message{
		schema.SystemMessage(v.systemPrompt),
		schema.UserMessage(userMsg),
	}

	resp, err := v.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("变式题生成失败: %w", err)
	}

	return resp.Content, nil
}
