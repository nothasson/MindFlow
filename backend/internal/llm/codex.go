package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const (
	codexEndpoint = "https://chatgpt.com/backend-api/codex/responses"
	tokenURL      = "https://auth.openai.com/oauth/token"
	codexClientID = "app_EMoamEEZ73f0CkXaXp7hrann"
)

// 确保 CodexProvider 实现 model.ChatModel 接口
var _ model.ChatModel = (*CodexProvider)(nil)

// CodexToken 存储 OAuth token 信息
type CodexToken struct {
	AccessToken  string
	RefreshToken string
	AccountID    string
	ExpiresAt    int64 // unix ms
}

// codexAuthFile ~/.codex/auth.json 的结构
type codexAuthFile struct {
	Tokens struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		AccountID    string `json:"account_id"`
	} `json:"tokens"`
}

// oauthCliKitFile oauth-cli-kit 的 codex.json 结构
type oauthCliKitFile struct {
	Access    string `json:"access"`
	Refresh   string `json:"refresh"`
	Expires   int64  `json:"expires"`
	AccountID string `json:"account_id"`
}

// CodexProvider 实现 Eino model.ChatModel 接口，通过 OAuth 调用 ChatGPT Codex Responses API
type CodexProvider struct {
	mu       sync.Mutex
	token    *CodexToken
	modelID  string
}

// NewCodexProvider 创建 Codex Provider
func NewCodexProvider(modelID string) *CodexProvider {
	if modelID == "" {
		modelID = "gpt-5.4"
	}
	return &CodexProvider{modelID: modelID}
}

// CodexIsAvailable 检查 Codex token 文件是否存在
func CodexIsAvailable() bool {
	for _, p := range codexTokenPaths() {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}

// Generate 实现 model.ChatModel 接口 — 非流式调用
func (c *CodexProvider) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	reader, err := c.Stream(ctx, input, opts...)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	var result strings.Builder
	for {
		msg, recvErr := reader.Recv()
		if recvErr != nil {
			if recvErr == io.EOF {
				break
			}
			return nil, recvErr
		}
		result.WriteString(msg.Content)
	}
	return &schema.Message{Role: schema.Assistant, Content: result.String()}, nil
}

// Stream 实现 model.ChatModel 接口 — 流式调用
func (c *CodexProvider) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	token, err := c.getToken()
	if err != nil {
		return nil, err
	}

	body := buildCodexBody(input, c.modelID)
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("序列化请求体失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", codexEndpoint, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Codex API 请求失败: %w", err)
	}

	if resp.StatusCode == 401 {
		resp.Body.Close()
		return nil, fmt.Errorf("Codex OAuth token 已过期或无效，请运行 codex login 重新登录")
	}
	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("Codex API 错误 (%d): %s", resp.StatusCode, string(errBody))
	}

	reader, writer := schema.Pipe[*schema.Message](1)

	go func() {
		defer resp.Body.Close()
		defer writer.Close()

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := line[6:]
			if payload == "[DONE]" {
				return
			}

			var event codexSSEEvent
			if err := json.Unmarshal([]byte(payload), &event); err != nil {
				continue
			}

			if event.Type == "response.output_text.delta" && event.Delta != "" {
				writer.Send(&schema.Message{
					Role:    schema.Assistant,
					Content: event.Delta,
				}, nil)
			}
		}
	}()

	return reader, nil
}

// BindTools 实现 model.ChatModel 接口 — Codex 不使用 tool binding，空实现
func (c *CodexProvider) BindTools(tools []*schema.ToolInfo) error {
	return nil
}

// --- Token 管理 ---

// tokenExpired 检查 token 是否过期（含 1 分钟 buffer）
func tokenExpired(t *CodexToken) bool {
	exp := t.ExpiresAt
	// ExpiresAt == 0 时从 JWT 解析
	if exp == 0 && t.AccessToken != "" {
		exp = parseJWTExpiryMs(t.AccessToken)
	}
	if exp == 0 {
		return false // 无法判断，假设未过期
	}
	return time.Now().UnixMilli() >= exp-60*1000
}

// parseJWTExpiryMs 从 JWT access_token 解析 exp 字段，返回毫秒时间戳
func parseJWTExpiryMs(token string) int64 {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return 0
	}
	payload, err := base64Decode(parts[1])
	if err != nil {
		return 0
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return 0
	}
	return claims.Exp * 1000 // 秒 -> 毫秒
}

func base64Decode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

func (c *CodexProvider) getToken() (*CodexToken, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 缓存的 token 未过期
	if c.token != nil && !tokenExpired(c.token) {
		return c.token, nil
	}

	// 过期或无缓存，先尝试刷新
	if c.token != nil && c.token.RefreshToken != "" {
		if refreshed, err := refreshCodexToken(c.token.RefreshToken); err == nil {
			c.token = refreshed
			return c.token, nil
		} else {
			log.Printf("Codex token 刷新失败: %v，尝试重新读取文件", err)
		}
	}

	// 从文件读取
	token, err := readCodexToken()
	if err != nil {
		return nil, fmt.Errorf("无法获取 Codex token: %w", err)
	}

	// 文件中的 token 也可能过期
	if tokenExpired(token) && token.RefreshToken != "" {
		if refreshed, err := refreshCodexToken(token.RefreshToken); err == nil {
			c.token = refreshed
			return c.token, nil
		}
	}

	c.token = token
	return c.token, nil
}

func codexTokenPaths() []string {
	home, _ := os.UserHomeDir()
	paths := []string{
		filepath.Join(home, ".codex", "auth.json"),
	}
	// macOS: ~/Library/Application Support/oauth-cli-kit/auth/codex.json
	paths = append(paths, filepath.Join(home, "Library", "Application Support", "oauth-cli-kit", "auth", "codex.json"))
	return paths
}

func readCodexToken() (*CodexToken, error) {
	home, _ := os.UserHomeDir()

	// 1. ~/.codex/auth.json（Codex CLI 格式）
	codexPath := filepath.Join(home, ".codex", "auth.json")
	if data, err := os.ReadFile(codexPath); err == nil {
		var auth codexAuthFile
		if err := json.Unmarshal(data, &auth); err == nil && auth.Tokens.AccessToken != "" {
			return &CodexToken{
				AccessToken:  auth.Tokens.AccessToken,
				RefreshToken: auth.Tokens.RefreshToken,
				AccountID:    auth.Tokens.AccountID,
			}, nil
		}
	}

	// 2. oauth-cli-kit 格式
	oauthPath := filepath.Join(home, "Library", "Application Support", "oauth-cli-kit", "auth", "codex.json")
	if data, err := os.ReadFile(oauthPath); err == nil {
		var oauthToken oauthCliKitFile
		if err := json.Unmarshal(data, &oauthToken); err == nil && oauthToken.Access != "" {
			return &CodexToken{
				AccessToken:  oauthToken.Access,
				RefreshToken: oauthToken.Refresh,
				AccountID:    oauthToken.AccountID,
				ExpiresAt:    oauthToken.Expires,
			}, nil
		}
	}

	return nil, fmt.Errorf("未找到 Codex OAuth token，请先运行 codex login 登录")
}

func refreshCodexToken(refreshToken string) (*CodexToken, error) {
	data := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"client_id":     {codexClientID},
	}

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("token 刷新请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token 刷新失败 (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析刷新响应失败: %w", err)
	}

	return &CodexToken{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		ExpiresAt:    time.Now().UnixMilli() + int64(result.ExpiresIn)*1000,
	}, nil
}

// --- 请求体构建 ---

type codexRequestBody struct {
	Model        string        `json:"model"`
	Instructions string        `json:"instructions"`
	Input        []interface{} `json:"input"`
	Stream       bool          `json:"stream"`
	Store        bool          `json:"store"`
}

type codexSSEEvent struct {
	Type  string `json:"type"`
	Delta string `json:"delta,omitempty"`
}

// buildCodexBody 将 Eino messages 转为 Responses API 格式
func buildCodexBody(messages []*schema.Message, modelID string) codexRequestBody {
	var instructionParts []string
	var input []interface{}

	for _, msg := range messages {
		if msg.Role == schema.System {
			if content := strings.TrimSpace(msg.Content); content != "" {
				instructionParts = append(instructionParts, content)
			}
		} else {
			input = append(input, map[string]string{
				"role":    string(msg.Role),
				"content": msg.Content,
			})
		}
	}

	instructions := "You are a helpful assistant."
	if len(instructionParts) > 0 {
		instructions = strings.Join(instructionParts, "\n\n")
	}

	if len(input) == 0 && len(messages) > 0 {
		input = []interface{}{
			map[string]string{"role": "user", "content": instructions},
		}
		instructions = "You are a helpful assistant."
	}

	return codexRequestBody{
		Model:        modelID,
		Instructions: instructions,
		Input:        input,
		Stream:       true,
		Store:        false,
	}
}
