package model

import (
	"time"

	"github.com/google/uuid"
)

// 错误类型常量 — 基础错误（5 种）
const (
	ErrorKnowledgeGap     = "knowledge_gap"      // 知识遗漏
	ErrorConceptConfusion = "concept_confusion"   // 概念混淆
	ErrorConceptError     = "concept_error"       // 概念错误
	ErrorMethodError      = "method_error"        // 方法错误
	ErrorCalculationError = "calculation_error"   // 计算错误
)

// 错误类型常量 — 元认知错误（3 种）
const (
	ErrorOverconfidence    = "overconfidence"     // 过度自信
	ErrorStrategyError     = "strategy_error"     // 策略错误
	ErrorUnclearExpression = "unclear_expression" // 表述不清
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
	Question      string     `json:"question"`      // 原题内容（来自 quiz_attempts）
	UserAnswer    string     `json:"user_answer"`    // 学生回答（来自 quiz_attempts）
	Reviewed      bool       `json:"reviewed"`
	ReviewCount   int        `json:"review_count"`
	NextReview    *time.Time `json:"next_review,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}
