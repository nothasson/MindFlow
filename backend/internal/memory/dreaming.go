package memory

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const dreamingPrompt = `你是 MindFlow 的记忆整理专家。你的任务是从学生的每日学习日志中提取关键信息，更新长期学习画像。

你会收到两个输入：
1. 当前的长期记忆（MEMORY.md），可能为空
2. 今天的学习日志

请分析日志内容，输出更新后的完整 MEMORY.md，格式如下：

# MEMORY.md - 学习画像

## 学习偏好
- （保留已有内容，根据日志补充新发现的偏好）

## 知识掌握度

### 已掌握
- 学科/概念名 (置信度 0.00-1.00) - YYYY-MM-DD 掌握

### 薄弱点
- 学科/概念名 (置信度 0.00-1.00) - 错误类型描述

### 错误模式
- （提炼出的典型错误模式）

## 学习历史
- YYYY-MM-DD: 简要记录

---
*最后更新：YYYY-MM-DD*

注意：
- 如果已有 MEMORY.md，在其基础上更新，不要丢失历史信息
- 新掌握的概念加到"已掌握"，更新置信度
- 发现的薄弱点加到"薄弱点"
- 如果原来是薄弱点，现在掌握了，移到"已掌握"
- 只输出完整的 MEMORY.md 内容，不要输出其他说明`

const learningsSummaryPrompt = `你是 MindFlow 的学习总结专家。请将以下每日学习日志提炼为精华总结。

只保留最重要的学习发现：
- 新掌握了什么
- 哪里有困难
- 关键错误模式
- 突破性理解

输出简洁的 Markdown 格式，不超过 300 字。`

// DreamingSweep 每日记忆整理任务
type DreamingSweep struct {
	store     *Store
	chatModel model.ChatModel
}

// NewDreamingSweep 创建 Dreaming Sweep
func NewDreamingSweep(store *Store, chatModel model.ChatModel) *DreamingSweep {
	return &DreamingSweep{
		store:     store,
		chatModel: chatModel,
	}
}

// Run 执行记忆整理（处理指定日期的日志，空字符串表示今天）
func (d *DreamingSweep) Run(ctx context.Context, date string) error {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	// 1. 读取今日日志
	dailyLog, err := d.store.GetDailyLog(date)
	if err != nil {
		return fmt.Errorf("读取日志失败: %w", err)
	}
	if dailyLog == "" {
		return nil // 没有日志，无需整理
	}

	// 2. 读取当前长期记忆
	longTermMemory, err := d.store.GetLongTermMemory()
	if err != nil {
		return fmt.Errorf("读取长期记忆失败: %w", err)
	}

	// 3. 调用 LLM 分析日志并更新长期记忆
	updatedMemory, err := d.updateLongTermMemory(ctx, longTermMemory, dailyLog)
	if err != nil {
		return fmt.Errorf("更新长期记忆失败: %w", err)
	}

	// 4. 写入更新后的 MEMORY.md
	if err := d.store.WriteLongTermMemory(updatedMemory); err != nil {
		return fmt.Errorf("写入长期记忆失败: %w", err)
	}

	// 5. 生成精华总结到 learnings/
	summary, err := d.generateLearningSummary(ctx, dailyLog)
	if err != nil {
		return fmt.Errorf("生成学习总结失败: %w", err)
	}

	if err := d.saveLearnings(date, summary); err != nil {
		return fmt.Errorf("保存学习总结失败: %w", err)
	}

	return nil
}

// updateLongTermMemory 调用 LLM 更新长期记忆
func (d *DreamingSweep) updateLongTermMemory(ctx context.Context, currentMemory, dailyLog string) (string, error) {
	userContent := fmt.Sprintf("## 当前长期记忆\n\n%s\n\n## 今日学习日志\n\n%s", currentMemory, dailyLog)

	messages := []*schema.Message{
		schema.SystemMessage(dreamingPrompt),
		schema.UserMessage(userContent),
	}

	resp, err := d.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	return resp.Content, nil
}

// generateLearningSummary 调用 LLM 生成精华总结
func (d *DreamingSweep) generateLearningSummary(ctx context.Context, dailyLog string) (string, error) {
	messages := []*schema.Message{
		schema.SystemMessage(learningsSummaryPrompt),
		schema.UserMessage(dailyLog),
	}

	resp, err := d.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	return resp.Content, nil
}

// saveLearnings 保存精华总结到 learnings/YYYY-MM-DD.md
func (d *DreamingSweep) saveLearnings(date, summary string) error {
	path := filepath.Join(d.store.baseDir, "learnings", date+".md")
	content := fmt.Sprintf("# %s 学习总结\n\n%s\n", date, summary)
	return os.WriteFile(path, []byte(content), 0644)
}
