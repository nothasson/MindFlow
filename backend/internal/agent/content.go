package agent

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/service"
)

const ContentAgentSystemPrompt = `你是 MindFlow 的内容理解专家。你的职责是基于用户上传的学习资料内容进行教学。

当收到资料内容后，你需要：
1. 理解资料的核心知识点
2. 根据学生的提问，从资料中找到相关内容
3. 以苏格拉底式引导的方式，帮助学生理解资料内容
4. 绝不直接复制粘贴资料原文作为答案，而是用自己的话引导

你会在系统消息中收到相关资料的检索结果，请基于这些内容回答学生的问题。

注意：
- 使用中文回复
- 如果检索结果与学生问题不相关，坦诚说明并引导学生换个角度提问
- 始终保持苏格拉底式的引导风格`

// ContentAgent 内容理解 Agent，基于上传资料进行教学
type ContentAgent struct {
	chatModel    model.ChatModel
	aiClient     *service.AIClient
	systemPrompt string
}

// NewContentAgent 创建 Content Agent
func NewContentAgent(chatModel model.ChatModel, aiClient *service.AIClient) *ContentAgent {
	return &ContentAgent{
		chatModel:    chatModel,
		aiClient:     aiClient,
		systemPrompt: ContentAgentSystemPrompt,
	}
}

// Chat 基于资料内容进行对话（非流式）
func (c *ContentAgent) Chat(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages, err := c.buildMessages(ctx, messages)
	if err != nil {
		return "", err
	}

	resp, err := c.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("LLM 生成失败: %w", err)
	}
	return resp.Content, nil
}

// ChatStream 基于资料内容进行流式对话
func (c *ContentAgent) ChatStream(ctx context.Context, messages []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
	fullMessages, err := c.buildMessages(ctx, messages)
	if err != nil {
		return nil, err
	}

	reader, err := c.chatModel.Stream(ctx, fullMessages)
	if err != nil {
		return nil, fmt.Errorf("LLM 流式生成失败: %w", err)
	}
	return reader, nil
}

// buildMessages 组装消息：system prompt + 检索到的资料上下文 + 用户对话
func (c *ContentAgent) buildMessages(ctx context.Context, messages []*schema.Message) ([]*schema.Message, error) {
	// 从最后一条用户消息中提取查询
	query := extractLastUserMessage(messages)

	// 构建 system prompt
	systemContent := c.systemPrompt

	// 如果有 AI 客户端，尝试检索相关资料
	if c.aiClient != nil && query != "" {
		results, err := c.aiClient.Search(query, "documents", 3)
		if err == nil && len(results.Results) > 0 {
			var contextParts []string
			for i, r := range results.Results {
				contextParts = append(contextParts, fmt.Sprintf("【资料片段 %d】(相关度 %.0f%%)\n%s", i+1, r.Score*100, r.Text))
			}
			systemContent += "\n\n## 检索到的相关资料\n\n" + strings.Join(contextParts, "\n\n")
		}
	}

	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(systemContent))
	fullMessages = append(fullMessages, messages...)
	return fullMessages, nil
}

// extractLastUserMessage 从消息列表中提取最后一条用户消息
func extractLastUserMessage(messages []*schema.Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == schema.User {
			return messages[i].Content
		}
	}
	return ""
}
