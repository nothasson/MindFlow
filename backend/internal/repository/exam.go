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
func (r *ExamRepo) CreateExamPlan(ctx context.Context, title string, examDate string, concepts []string, accelerationFactor float64) (*model.ExamPlan, error) {
	var plan model.ExamPlan
	err := r.pool.QueryRow(ctx,
		`INSERT INTO exam_plans (title, exam_date, concepts, acceleration_factor)
		 VALUES ($1, $2::date, $3, $4)
		 RETURNING id, title, exam_date, concepts, acceleration_factor, active, created_at`,
		title, examDate, concepts, accelerationFactor,
	).Scan(&plan.ID, &plan.Title, &plan.ExamDate, &plan.Concepts,
		&plan.AccelerationFactor, &plan.Active, &plan.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("创建考试计划失败: %w", err)
	}
	return &plan, nil
}

// ListExamPlans 列出所有考试计划
func (r *ExamRepo) ListExamPlans(ctx context.Context) ([]model.ExamPlan, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, exam_date, concepts, acceleration_factor, active, created_at
		 FROM exam_plans ORDER BY exam_date ASC`,
	)
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
func (r *ExamRepo) DeleteExamPlan(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM exam_plans WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("删除考试计划失败: %w", err)
	}
	return nil
}
