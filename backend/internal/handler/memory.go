package handler

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/utils"

	"github.com/nothasson/MindFlow/backend/internal/memory"
)

// MemoryHandler 记忆 API 处理器
type MemoryHandler struct {
	store *memory.Store
}

// NewMemoryHandler 创建记忆处理器
func NewMemoryHandler(store *memory.Store) *MemoryHandler {
	return &MemoryHandler{store: store}
}

// Profile GET /api/memory/profile — 学习画像
func (h *MemoryHandler) Profile(ctx context.Context, c *app.RequestContext) {
	if h.store == nil {
		c.JSON(http.StatusOK, utils.H{"profile": "", "exists": false})
		return
	}

	content, err := h.store.GetLongTermMemory()
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "读取学习画像失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, utils.H{
		"profile": content,
		"exists":  content != "",
	})
}

// Timeline GET /api/memory/timeline — 学习时间线
func (h *MemoryHandler) Timeline(ctx context.Context, c *app.RequestContext) {
	if h.store == nil {
		c.JSON(http.StatusOK, utils.H{"entries": []interface{}{}})
		return
	}

	baseDir := h.store.GetBaseDir()
	memoryDir := filepath.Join(baseDir, "memory")
	learningsDir := filepath.Join(baseDir, "learnings")

	type TimelineEntry struct {
		Date     string `json:"date"`
		Log      string `json:"log"`
		Learning string `json:"learning"`
	}

	// 扫描 memory 目录
	dates := map[string]*TimelineEntry{}

	if entries, err := os.ReadDir(memoryDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
				continue
			}
			date := strings.TrimSuffix(e.Name(), ".md")
			content, _ := os.ReadFile(filepath.Join(memoryDir, e.Name()))
			if dates[date] == nil {
				dates[date] = &TimelineEntry{Date: date}
			}
			dates[date].Log = string(content)
		}
	}

	// 扫描 learnings 目录
	if entries, err := os.ReadDir(learningsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
				continue
			}
			date := strings.TrimSuffix(e.Name(), ".md")
			content, _ := os.ReadFile(filepath.Join(learningsDir, e.Name()))
			if dates[date] == nil {
				dates[date] = &TimelineEntry{Date: date}
			}
			dates[date].Learning = string(content)
		}
	}

	// 转为列表并按日期倒序
	var timeline []TimelineEntry
	for _, entry := range dates {
		timeline = append(timeline, *entry)
	}
	sort.Slice(timeline, func(i, j int) bool {
		return timeline[i].Date > timeline[j].Date
	})

	// 最多返回 30 天
	if len(timeline) > 30 {
		timeline = timeline[:30]
	}

	c.JSON(http.StatusOK, utils.H{"entries": timeline})
}

// Search GET /api/memory/search?q=xxx — 搜索记忆
func (h *MemoryHandler) Search(ctx context.Context, c *app.RequestContext) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, utils.H{"error": "搜索关键词不能为空"})
		return
	}

	if h.store == nil {
		c.JSON(http.StatusOK, utils.H{"results": []interface{}{}})
		return
	}

	results, err := h.store.Search(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, utils.H{"error": "搜索失败: " + err.Error()})
		return
	}

	type SearchResultDTO struct {
		Source  string `json:"source"`
		Content string `json:"content"`
	}

	var dto []SearchResultDTO
	for _, r := range results {
		// 截取匹配上下文（前后 200 字符）
		snippet := r.Content
		if len(snippet) > 500 {
			snippet = snippet[:500] + "..."
		}
		dto = append(dto, SearchResultDTO{
			Source:  r.Source,
			Content: snippet,
		})
	}

	c.JSON(http.StatusOK, utils.H{"results": dto})
}
