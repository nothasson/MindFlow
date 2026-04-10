package model

import (
	"time"

	"github.com/google/uuid"
)

// KnowledgeSourceLink 知识点来源关联
// 记录知识点从哪份资料提取、在哪些对话/测验中涉及。
type KnowledgeSourceLink struct {
	ID             uuid.UUID `json:"id"`
	Concept        string    `json:"concept"`
	SourceType     string    `json:"source_type"`      // "resource" / "conversation" / "quiz"
	SourceID       uuid.UUID `json:"source_id"`
	PageOrPosition string    `json:"page_or_position"`
	CreatedAt      time.Time `json:"created_at"`
}
