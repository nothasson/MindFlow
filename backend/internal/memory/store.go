package memory

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Store 记忆文件存储
type Store struct {
	baseDir string
}

// NewStore 创建记忆存储
func NewStore(baseDir string) (*Store, error) {
	// 确保目录存在
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

// GetLongTermMemory 读取 MEMORY.md（L0+L1 层）
func (s *Store) GetLongTermMemory() (string, error) {
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

// WriteLongTermMemory 写入 MEMORY.md
func (s *Store) WriteLongTermMemory(content string) error {
	path := filepath.Join(s.baseDir, "MEMORY.md")
	return os.WriteFile(path, []byte(content), 0644)
}

// GetDailyLog 读取每日学习日志（L2 层）
func (s *Store) GetDailyLog(date string) (string, error) {
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
	path := filepath.Join(s.baseDir, "memory", date+".md")

	existing, _ := os.ReadFile(path)
	content := string(existing)

	if content == "" {
		content = fmt.Sprintf("# %s 学习日志\n\n", date)
	}

	timestamp := time.Now().Format("15:04:05")
	content += fmt.Sprintf("## %s\n\n%s\n\n", timestamp, entry)

	return os.WriteFile(path, []byte(content), 0644)
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

// Search 搜索记忆（简单关键词匹配，后续升级为向量搜索）
func (s *Store) Search(query string) ([]SearchResult, error) {
	var results []SearchResult

	// 搜索 MEMORY.md
	longTerm, err := s.GetLongTermMemory()
	if err == nil && longTerm != "" && strings.Contains(longTerm, query) {
		results = append(results, SearchResult{
			Source:  "MEMORY.md",
			Content: longTerm,
		})
	}

	// 搜索最近 7 天的日志
	for i := 0; i < 7; i++ {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		log, err := s.GetDailyLog(date)
		if err == nil && log != "" && strings.Contains(log, query) {
			results = append(results, SearchResult{
				Source:  fmt.Sprintf("memory/%s.md", date),
				Content: log,
			})
		}
	}

	return results, nil
}

// SaveLearnings 保存精华总结到 learnings/YYYY-MM-DD.md
func (s *Store) SaveLearnings(date string, content string) error {
	dir := filepath.Join(s.baseDir, "learnings")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("创建 learnings 目录失败: %w", err)
	}
	path := filepath.Join(dir, date+".md")
	return os.WriteFile(path, []byte(content), 0644)
}

// SearchResult 搜索结果
type SearchResult struct {
	Source  string
	Content string
}
