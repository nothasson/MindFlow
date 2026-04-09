package llm

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino-ext/components/model/openai"

	"github.com/nothasson/MindFlow/backend/internal/config"
)

// NewChatModel 创建 LLM ChatModel 客户端
// 使用 Eino 的 OpenAI 兼容组件连接硅基流动 API
func NewChatModel(ctx context.Context, cfg *config.Config) (model.ChatModel, error) {
	chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:  cfg.LLMAPIKey,
		Model:   cfg.LLMModel,
		BaseURL: cfg.LLMBaseURL,
	})
	if err != nil {
		return nil, fmt.Errorf("创建 ChatModel 失败: %w", err)
	}
	return chatModel, nil
}
