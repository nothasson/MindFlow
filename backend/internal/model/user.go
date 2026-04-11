package model

import (
	"time"

	"github.com/google/uuid"
)

// User 用户
type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // 不序列化到 JSON
	DisplayName  string    `json:"display_name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
