package memory

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

var dateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// Store 记忆文件存储（带并发锁和原子写入）
type Store struct {
	baseDir string
	mu      sync.RWMutex
}

// NewStore 创建记忆存储
func NewStore(baseDir string) (*Store, error) {
	dirs := []string{
		baseDir,
		filepath.Join(baseDir, "memory"),
		filepath.Join(baseDir, "learnings"),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建目录失败 %s: %w", dir, err)
		}
	}

	return &Store{baseDir: baseDir}, nil
}

// GetBaseDir 返回记忆根目录
func (s *Store) GetBaseDir() string {
	return s.baseDir
}

// GetLongTermMemory 读取 MEMORY.md（L0+L1 层）
func (s *Store) GetLongTermMemory() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	path := filepath.Join(s.baseDir, "MEMORY.md")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

// WriteLongTermMemory 原子写入 MEMORY.md（write-temp + rename）
func (s *Store) WriteLongTermMemory(content string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return atomicWrite(filepath.Join(s.baseDir, "MEMORY.md"), []byte(content))
}

// GetDailyLog 读取每日学习日志（L2 层）
func (s *Store) GetDailyLog(date string) (string, error) {
	if !isValidDate(date) {
		return "", fmt.Errorf("无效的日期格式: %s（期望 YYYY-MM-DD）", date)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	path := filepath.Join(s.baseDir, "memory", date+".md")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

// AppendDailyLog 追加每日学习日志
func (s *Store) AppendDailyLog(date string, entry string) error {
	if !isValidDate(date) {
		return fmt.Errorf("无效的日期格式: %s（期望 YYYY-MM-DD）", date)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	path := filepath.Join(s.baseDir, "memory", date+".md")

	existing, _ := os.ReadFile(path)
	content := string(existing)

	if content == "" {
		content = fmt.Sprintf("# %s 学习日志\n\n", date)
	}

	timestamp := time.Now().Format("15:04:05")
	content += fmt.Sprintf("## %s\n\n%s\n\n", timestamp, entry)

	return atomicWrite(path, []byte(content))
}

// GetTodayLog 获取今天的学习日志
func (s *Store) GetTodayLog() (string, error) {
	today := time.Now().Format("2006-01-02")
	return s.GetDailyLog(today)
}

// AppendTodayLog 追加今天的日志
func (s *Store) AppendTodayLog(entry string) error {
	today := time.Now().Format("2006-01-02")
	return s.AppendDailyLog(today, entry)
}

// Search 搜索记忆（返回匹配片段，不返回全文）
func (s *Store) Search(query string) ([]SearchResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []SearchResult

	// 搜索 MEMORY.md
	longTerm, err := s.getLongTermMemoryUnsafe()
	if err == nil && longTerm != "" && strings.Contains(longTerm, query) {
		results = append(results, SearchResult{
			Source:  "MEMORY.md",
			Content: extractSnippet(longTerm, query, 300),
		})
	}

	// 搜索最近 7 天的日志
	for i := 0; i < 7; i++ {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		path := filepath.Join(s.baseDir, "memory", date+".md")
		data, err := os.ReadFile(path)
		if err != nil || len(data) == 0 {
			continue
		}
		log := string(data)
		if strings.Contains(log, query) {
			results = append(results, SearchResult{
				Source:  fmt.Sprintf("memory/%s.md", date),
				Content: extractSnippet(log, query, 300),
			})
		}
	}

	return results, nil
}

// SaveLearnings 保存精华总结到 learnings/YYYY-MM-DD.md
func (s *Store) SaveLearnings(date string, content string) error {
	if !isValidDate(date) {
		return fmt.Errorf("无效的日期格式: %s", date)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join(s.baseDir, "learnings")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建 learnings 目录失败: %w", err)
	}
	return atomicWrite(filepath.Join(dir, date+".md"), []byte(content))
}

// getLongTermMemoryUnsafe 无锁读取（供内部已持锁的方法调用）
func (s *Store) getLongTermMemoryUnsafe() (string, error) {
	path := filepath.Join(s.baseDir, "MEMORY.md")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	return string(data), nil
}

// SearchResult 搜索结果
type SearchResult struct {
	Source  string
	Content string
}

// atomicWrite 原子写入文件（write-temp + rename）
func atomicWrite(path string, data []byte) error {
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("写入临时文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath) // 清理
		return fmt.Errorf("重命名文件失败: %w", err)
	}
	return nil
}

// isValidDate 校验日期格式 YYYY-MM-DD
func isValidDate(date string) bool {
	return dateRegex.MatchString(date)
}

// extractSnippet 提取包含关键词的片段（上下文 contextLen 字符）
func extractSnippet(text, query string, contextLen int) string {
	idx := strings.Index(text, query)
	if idx < 0 {
		if len(text) > contextLen {
			return text[:contextLen] + "..."
		}
		return text
	}

	start := idx - contextLen/2
	if start < 0 {
		start = 0
	}
	end := idx + len(query) + contextLen/2
	if end > len(text) {
		end = len(text)
	}

	snippet := text[start:end]
	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(text) {
		snippet = snippet + "..."
	}
	return snippet
}
