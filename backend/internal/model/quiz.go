package model

import (
	"time"

	"github.com/google/uuid"
)

// QuizAttempt 测验记录
type QuizAttempt struct {
	ID          uuid.UUID  `json:"id"`
	CourseID    *uuid.UUID `json:"course_id,omitempty"`
	SectionID   *uuid.UUID `json:"section_id,omitempty"`
	Question    string     `json:"question"`
	UserAnswer  string     `json:"user_answer"`
	IsCorrect   bool       `json:"is_correct"`
	Score       int        `json:"score"`
	Explanation string     `json:"explanation"`
	CreatedAt   time.Time  `json:"created_at"`
}

// WrongBookEntry 错题本条目
type WrongBookEntry struct {
	ID            uuid.UUID  `json:"id"`
	QuizAttemptID uuid.UUID  `json:"quiz_attempt_id"`
	Concept       string     `json:"concept"`
	ErrorType     string     `json:"error_type"`
	Reviewed      bool       `json:"reviewed"`
	ReviewCount   int        `json:"review_count"`
	NextReview    *time.Time `json:"next_review,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}
