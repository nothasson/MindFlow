package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// QuizRepo 测验数据访问
type QuizRepo struct {
	pool *pgxpool.Pool
}

// NewQuizRepo 创建测验仓库
func NewQuizRepo(db *DB) *QuizRepo {
	return &QuizRepo{pool: db.Pool}
}

// CreateAttempt 记录一次答题
func (r *QuizRepo) CreateAttempt(ctx context.Context, courseID, sectionID *uuid.UUID, question, userAnswer string, isCorrect bool, score int, explanation string) (*model.QuizAttempt, error) {
	var attempt model.QuizAttempt
	err := r.pool.QueryRow(ctx,
		`INSERT INTO quiz_attempts (course_id, section_id, question, user_answer, is_correct, score, explanation)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, course_id, section_id, question, user_answer, is_correct, score, explanation, created_at`,
		courseID, sectionID, question, userAnswer, isCorrect, score, explanation,
	).Scan(&attempt.ID, &attempt.CourseID, &attempt.SectionID, &attempt.Question,
		&attempt.UserAnswer, &attempt.IsCorrect, &attempt.Score, &attempt.Explanation, &attempt.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &attempt, nil
}

// GetWrongAnswers 获取错题列表
func (r *QuizRepo) GetWrongAnswers(ctx context.Context) ([]model.QuizAttempt, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, course_id, section_id, question, user_answer, is_correct, score, explanation, created_at
		 FROM quiz_attempts WHERE is_correct = FALSE ORDER BY created_at DESC LIMIT 50`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attempts []model.QuizAttempt
	for rows.Next() {
		var a model.QuizAttempt
		if err := rows.Scan(&a.ID, &a.CourseID, &a.SectionID, &a.Question,
			&a.UserAnswer, &a.IsCorrect, &a.Score, &a.Explanation, &a.CreatedAt); err != nil {
			return nil, err
		}
		attempts = append(attempts, a)
	}
	return attempts, nil
}

// GetStats 获取答题统计
func (r *QuizRepo) GetStats(ctx context.Context) (total, correct, wrong int, err error) {
	err = r.pool.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE is_correct), COUNT(*) FILTER (WHERE NOT is_correct)
		 FROM quiz_attempts`,
	).Scan(&total, &correct, &wrong)
	return
}
