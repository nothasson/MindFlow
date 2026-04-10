package model

import (
	"time"

	"github.com/google/uuid"
)

// Course 课程
type Course struct {
	ID              uuid.UUID `json:"id"`
	ResourceID      *uuid.UUID `json:"resource_id,omitempty"`
	Title           string    `json:"title"`
	Summary         string    `json:"summary"`
	DifficultyLevel string    `json:"difficulty_level"`
	Style           string    `json:"style"`
	SectionCount    int       `json:"section_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CourseSection 课程章节
type CourseSection struct {
	ID                 uuid.UUID `json:"id"`
	CourseID           uuid.UUID `json:"course_id"`
	Title              string    `json:"title"`
	Summary            string    `json:"summary"`
	Content            string    `json:"content"`
	OrderIndex         int       `json:"order_index"`
	LearningObjectives string    `json:"learning_objectives"`
	QuestionPrompts    string    `json:"question_prompts"`
	CreatedAt          time.Time `json:"created_at"`
}

// CourseProgress 课程进度
type CourseProgress struct {
	ID           uuid.UUID `json:"id"`
	CourseID     uuid.UUID `json:"course_id"`
	SectionID    uuid.UUID `json:"section_id"`
	Completed    bool      `json:"completed"`
	MasteryScore float64   `json:"mastery_score"`
	UpdatedAt    time.Time `json:"updated_at"`
}
