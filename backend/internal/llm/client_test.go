package llm

import (
	"context"
	"testing"

	"github.com/nothasson/MindFlow/backend/internal/config"
)

func TestNewChatModel(t *testing.T) {
	cfg := &config.Config{
		LLMAPIKey:  "test-key",
		LLMModel:   "test-model",
		LLMBaseURL: "https://api.siliconflow.cn/v1",
	}

	chatModel, err := NewChatModel(context.Background(), cfg)
	if err != nil {
		t.Fatalf("NewChatModel 返回错误: %v", err)
	}
	if chatModel == nil {
		t.Fatal("NewChatModel 返回 nil")
	}
}
