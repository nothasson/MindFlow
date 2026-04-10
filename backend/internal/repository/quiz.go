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

// CreateWrongBookEntry 写入错题本
func (r *QuizRepo) CreateWrongBookEntry(ctx context.Context, attemptID uuid.UUID, concept, errorType string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO wrong_book (quiz_attempt_id, concept, error_type)
		 VALUES ($1, $2, $3)`,
		attemptID, concept, errorType,
	)
	return err
}

// ListWrongBook 获取错题本列表（JOIN 原题内容）
func (r *QuizRepo) ListWrongBook(ctx context.Context, limit int) ([]model.WrongBookEntry, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT wb.id, wb.quiz_attempt_id, wb.concept, wb.error_type,
		        COALESCE(qa.question, ''), COALESCE(qa.user_answer, ''),
		        wb.reviewed, wb.review_count, wb.next_review, wb.created_at
		 FROM wrong_book wb
		 LEFT JOIN quiz_attempts qa ON qa.id = wb.quiz_attempt_id
		 ORDER BY wb.created_at DESC LIMIT $1`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []model.WrongBookEntry
	for rows.Next() {
		var e model.WrongBookEntry
		if err := rows.Scan(&e.ID, &e.QuizAttemptID, &e.Concept, &e.ErrorType,
			&e.Question, &e.UserAnswer,
			&e.Reviewed, &e.ReviewCount, &e.NextReview, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// WrongBookStats 错题统计（按错误类型分组）
type WrongBookStats struct {
	ErrorType string `json:"error_type"`
	Count     int    `json:"count"`
}

// GetWrongBookStats 获取错题统计
func (r *QuizRepo) GetWrongBookStats(ctx context.Context) ([]WrongBookStats, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT error_type, COUNT(*) FROM wrong_book WHERE NOT reviewed GROUP BY error_type ORDER BY COUNT(*) DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []WrongBookStats
	for rows.Next() {
		var s WrongBookStats
		if err := rows.Scan(&s.ErrorType, &s.Count); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

// MarkWrongBookReviewed 标记错题为已复习
func (r *QuizRepo) MarkWrongBookReviewed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE wrong_book SET reviewed = TRUE, review_count = review_count + 1 WHERE id = $1`, id,
	)
	return err
}

// DeleteWrongBookEntry 删除错题
func (r *QuizRepo) DeleteWrongBookEntry(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM wrong_book WHERE id = $1`, id)
	return err
}
