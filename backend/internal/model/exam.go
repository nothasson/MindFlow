package model

import (
	"time"

	"github.com/google/uuid"
)

// ExamPlan 考试计划
type ExamPlan struct {
	ID                 uuid.UUID `json:"id"`
	Title              string    `json:"title"`
	ExamDate           time.Time `json:"exam_date"`
	Concepts           []string  `json:"concepts"`
	AccelerationFactor float64   `json:"acceleration_factor"`
	Active             bool      `json:"active"`
	CreatedAt          time.Time `json:"created_at"`
}
