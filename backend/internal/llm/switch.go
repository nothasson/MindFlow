package llm

import (
	"context"
	"fmt"
	"sync"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// 确保 ModelSwitch 实现 model.ChatModel 接口
var _ model.ChatModel = (*ModelSwitch)(nil)

// ProviderInfo 描述一个可用的 LLM 提供方
type ProviderInfo struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model"`
}

// ModelSwitch 是一个 ChatModel 代理，可在运行时切换底层实现。
type ModelSwitch struct {
	mu       sync.RWMutex
	active   string                     // 当前激活的 provider id
	models   map[string]model.ChatModel // provider id -> ChatModel
	infos    []ProviderInfo             // 注册顺序
}

// NewModelSwitch 创建一个 ModelSwitch
func NewModelSwitch() *ModelSwitch {
	return &ModelSwitch{
		models: make(map[string]model.ChatModel),
	}
}

// Register 注册一个 provider。第一个注册的自动成为 active。
func (s *ModelSwitch) Register(id, name, modelName string, m model.ChatModel) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.models[id] = m
	s.infos = append(s.infos, ProviderInfo{ID: id, Name: name, Model: modelName})
	if s.active == "" {
		s.active = id
	}
}

// SetActive 切换当前激活的 provider
func (s *ModelSwitch) SetActive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.models[id]; !ok {
		return fmt.Errorf("未知的 provider: %s", id)
	}
	s.active = id
	return nil
}

// Active 返回当前激活的 provider id
func (s *ModelSwitch) Active() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

// Providers 返回所有已注册的 provider 信息
func (s *ModelSwitch) Providers() []ProviderInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ProviderInfo, len(s.infos))
	copy(out, s.infos)
	return out
}

// current 返回当前激活的底层 ChatModel
func (s *ModelSwitch) current() model.ChatModel {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.models[s.active]
}

// --- 实现 model.ChatModel 接口，转发到当前 active 的 model ---

func (s *ModelSwitch) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	cur := s.current()
	if cur == nil {
		return nil, fmt.Errorf("没有可用的 LLM provider")
	}
	return cur.Generate(ctx, input, opts...)
}

func (s *ModelSwitch) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	cur := s.current()
	if cur == nil {
		return nil, fmt.Errorf("没有可用的 LLM provider")
	}
	return cur.Stream(ctx, input, opts...)
}

func (s *ModelSwitch) BindTools(tools []*schema.ToolInfo) error {
	cur := s.current()
	if cur == nil {
		return fmt.Errorf("没有可用的 LLM provider")
	}
	return cur.BindTools(tools)
}
