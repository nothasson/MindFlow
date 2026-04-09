package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"

	"github.com/nothasson/MindFlow/backend/internal/memory"
)

const MemoryAgentSystemPrompt = `你是 MindFlow 的记忆管理专家。你的职责是维护学生的学习画像。

当收到学习对话记录后，你需要提取以下信息并以 Markdown 格式输出：

## 本次学习摘要

- **学习主题**：（今天学了什么）
- **掌握情况**：（哪些概念掌握了、哪些还不行）
- **错误模式**：（如果有错误，是什么类型）
- **学习建议**：（下次应该重点复习什么）

注意：
- 使用中文
- 提取关键信息，不要逐字复述对话
- 重点关注掌握度变化`

// MemoryAgent 记忆管理 Agent
type MemoryAgent struct {
	chatModel    model.ChatModel
	store        *memory.Store
	systemPrompt string
}

// NewMemoryAgent 创建记忆 Agent
func NewMemoryAgent(chatModel model.ChatModel, store *memory.Store) *MemoryAgent {
	return &MemoryAgent{
		chatModel:    chatModel,
		store:        store,
		systemPrompt: MemoryAgentSystemPrompt,
	}
}

// Summarize 总结对话并保存到每日日志
func (m *MemoryAgent) Summarize(ctx context.Context, messages []*schema.Message) (string, error) {
	fullMessages := make([]*schema.Message, 0, len(messages)+1)
	fullMessages = append(fullMessages, schema.SystemMessage(m.systemPrompt))
	fullMessages = append(fullMessages, messages...)

	resp, err := m.chatModel.Generate(ctx, fullMessages)
	if err != nil {
		return "", fmt.Errorf("记忆总结失败: %w", err)
	}

	// 保存到今日日志
	if m.store != nil {
		if err := m.store.AppendTodayLog(resp.Content); err != nil {
			return resp.Content, fmt.Errorf("保存日志失败: %w", err)
		}
	}

	return resp.Content, nil
}

// GetContext 获取学生上下文（L0+L1 层，始终加载）
func (m *MemoryAgent) GetContext() (string, error) {
	if m.store == nil {
		return "", nil
	}
	return m.store.GetLongTermMemory()
}

// Search 搜索记忆
func (m *MemoryAgent) Search(query string) ([]memory.SearchResult, error) {
	if m.store == nil {
		return nil, nil
	}
	return m.store.Search(query)
}
