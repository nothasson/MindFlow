package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// ExamRepo 考试计划数据访问
type ExamRepo struct {
	pool *pgxpool.Pool
}

// NewExamRepo 创建考试计划仓库
func NewExamRepo(db *DB) *ExamRepo {
	return &ExamRepo{pool: db.Pool}
}

// CreateExamPlan 创建考试计划
func (r *ExamRepo) CreateExamPlan(ctx context.Context, title string, examDate string, concepts []string, accelerationFactor float64, userID ...*uuid.UUID) (*model.ExamPlan, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}
	var plan model.ExamPlan
	err := r.pool.QueryRow(ctx,
		`INSERT INTO exam_plans (title, exam_date, concepts, acceleration_factor, user_id)
		 VALUES ($1, $2::date, $3, $4, $5)
		 RETURNING id, title, exam_date, concepts, acceleration_factor, active, created_at`,
		title, examDate, concepts, accelerationFactor, uid,
	).Scan(&plan.ID, &plan.Title, &plan.ExamDate, &plan.Concepts,
		&plan.AccelerationFactor, &plan.Active, &plan.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("创建考试计划失败: %w", err)
	}
	return &plan, nil
}

// ListExamPlans 列出所有考试计划
func (r *ExamRepo) ListExamPlans(ctx context.Context, userID ...*uuid.UUID) ([]model.ExamPlan, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}
	var query string
	var args []interface{}
	if uid != nil {
		query = `SELECT id, title, exam_date, concepts, acceleration_factor, active, created_at
		 FROM exam_plans WHERE user_id = $1 ORDER BY exam_date ASC`
		args = []interface{}{*uid}
	} else {
		query = `SELECT id, title, exam_date, concepts, acceleration_factor, active, created_at
		 FROM exam_plans WHERE user_id IS NULL ORDER BY exam_date ASC`
	}
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("查询考试计划失败: %w", err)
	}
	defer rows.Close()

	var plans []model.ExamPlan
	for rows.Next() {
		var p model.ExamPlan
		if err := rows.Scan(&p.ID, &p.Title, &p.ExamDate, &p.Concepts,
			&p.AccelerationFactor, &p.Active, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("扫描考试计划失败: %w", err)
		}
		plans = append(plans, p)
	}
	return plans, rows.Err()
}

// GetActiveExamPlan 获取当前激活的考试计划（最近的一个）
func (r *ExamRepo) GetActiveExamPlan(ctx context.Context) (*model.ExamPlan, error) {
	var plan model.ExamPlan
	err := r.pool.QueryRow(ctx,
		`SELECT id, title, exam_date, concepts, acceleration_factor, active, created_at
		 FROM exam_plans WHERE active = TRUE ORDER BY exam_date ASC LIMIT 1`,
	).Scan(&plan.ID, &plan.Title, &plan.ExamDate, &plan.Concepts,
		&plan.AccelerationFactor, &plan.Active, &plan.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("查询激活考试计划失败: %w", err)
	}
	return &plan, nil
}

// DeleteExamPlan 删除考试计划
// userID 非 nil 时加归属校验
func (r *ExamRepo) DeleteExamPlan(ctx context.Context, id uuid.UUID, userID ...*uuid.UUID) error {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	query := `DELETE FROM exam_plans WHERE id = $1`
	args := []interface{}{id}
	if uid != nil {
		query += ` AND (user_id = $2 OR user_id IS NULL)`
		args = append(args, *uid)
	}

	_, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("删除考试计划失败: %w", err)
	}
	return nil
}
