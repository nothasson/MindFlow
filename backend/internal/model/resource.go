package model

import (
	"time"

	"github.com/google/uuid"
)

// Resource 学习资料
// 记录用户上传并已进入处理管线的原始资料。
type Resource struct {
	ID               uuid.UUID `json:"id"`
	SourceType       string    `json:"source_type"`
	Title            string    `json:"title"`
	OriginalFilename string    `json:"original_filename"`
	SourceURL        string    `json:"source_url,omitempty"`
	ContentText      string    `json:"content_text,omitempty"`
	Pages            int       `json:"pages"`
	ChunkCount       int       `json:"chunk_count"`
	Status           string    `json:"status"`
	Summary          string    `json:"summary,omitempty"`
	Questions        []string  `json:"questions,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
