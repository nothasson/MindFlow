package agent

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

const CoursewareSystemPrompt = `你是 MindFlow 的课程生成专家。你的职责是将学习资料转化为结构化的章节课程。

当收到一段学习资料后，你需要：

1. 分析资料内容，提取核心知识点
2. 将内容拆分为 3-8 个章节
3. 为每个章节生成：
   - 章节标题
   - 章节摘要（2-3 句话）
   - 学习目标（3-5 个要点）
   - 关键问题（2-3 个启发性问题）

输出格式（严格遵守）：

## 课程标题：[课程标题]

## 课程摘要
[整体课程摘要，3-5 句话]

---

### 第 1 章：[章节标题]

**摘要**：[章节摘要]

**学习目标**：
- [目标1]
- [目标2]
- [目标3]

**关键问题**：
- [问题1]
- [问题2]

---

### 第 2 章：[章节标题]

...

注意：
- 使用中文
- 每章内容独立但有递进关系
- 关键问题是苏格拉底式的，引导思考而非直接给答案
- 学习目标要具体可衡量`

// CoursewareAgent 课程生成 Agent
type CoursewareAgent struct {
	chatModel    model.ChatModel
	systemPrompt string
}

// NewCoursewareAgent 创建课程生成 Agent
func NewCoursewareAgent(chatModel model.ChatModel) *CoursewareAgent {
	return &CoursewareAgent{
		chatModel:    chatModel,
		systemPrompt: CoursewareSystemPrompt,
	}
}

// GenerateCourse 根据资料生成课程大纲
func (c *CoursewareAgent) GenerateCourse(ctx context.Context, resourceText string, difficulty string) (string, error) {
	messages := []*schema.Message{
		schema.SystemMessage(c.systemPrompt),
		schema.UserMessage(fmt.Sprintf(
			"请根据以下学习资料生成课程。难度等级：%s\n\n---\n\n%s",
			difficulty, resourceText,
		)),
	}

	resp, err := c.chatModel.Generate(ctx, messages)
	if err != nil {
		return "", fmt.Errorf("课程生成失败: %w", err)
	}

	return resp.Content, nil
}

// GenerateCourseStream 流式生成课程
func (c *CoursewareAgent) GenerateCourseStream(ctx context.Context, resourceText string, difficulty string) (*schema.StreamReader[*schema.Message], error) {
	messages := []*schema.Message{
		schema.SystemMessage(c.systemPrompt),
		schema.UserMessage(fmt.Sprintf(
			"请根据以下学习资料生成课程。难度等级：%s\n\n---\n\n%s",
			difficulty, resourceText,
		)),
	}

	reader, err := c.chatModel.Stream(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("流式课程生成失败: %w", err)
	}

	return reader, nil
}
