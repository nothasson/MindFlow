package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EvaluationRepo LLM 评估数据访问
type EvaluationRepo struct {
	pool *pgxpool.Pool
}

// NewEvaluationRepo 创建评估仓库
func NewEvaluationRepo(db *DB) *EvaluationRepo {
	return &EvaluationRepo{pool: db.Pool}
}

// EvaluationStats 评估统计结果
type EvaluationStats struct {
	EvalType   string  `json:"eval_type"`
	AvgScore   float64 `json:"avg_score"`
	TotalCount int     `json:"total_count"`
}

// CreateEvaluation 创建一条评估记录（userID 可为 nil）
func (r *EvaluationRepo) CreateEvaluation(ctx context.Context, evalType string, convID *uuid.UUID, score float64, details map[string]interface{}, userID ...*uuid.UUID) error {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	detailsJSON, err := json.Marshal(details)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO llm_evaluations (eval_type, conversation_id, score, details, user_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		evalType, convID, score, detailsJSON, uid,
	)
	return err
}

// GetEvaluationStats 获取指定类型的评估统计（userID 非 nil 时按用户过滤）
func (r *EvaluationRepo) GetEvaluationStats(ctx context.Context, evalType string, userID ...*uuid.UUID) (*EvaluationStats, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var stats EvaluationStats
	stats.EvalType = evalType

	var err error
	if uid != nil {
		err = r.pool.QueryRow(ctx,
			`SELECT COALESCE(AVG(score), 0), COUNT(*) FROM llm_evaluations WHERE eval_type = $1 AND (user_id = $2 OR user_id IS NULL)`,
			evalType, *uid,
		).Scan(&stats.AvgScore, &stats.TotalCount)
	} else {
		err = r.pool.QueryRow(ctx,
			`SELECT COALESCE(AVG(score), 0), COUNT(*) FROM llm_evaluations WHERE eval_type = $1`,
			evalType,
		).Scan(&stats.AvgScore, &stats.TotalCount)
	}
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// GetAllStats 获取所有评估类型的统计（userID 非 nil 时按用户过滤）
func (r *EvaluationRepo) GetAllStats(ctx context.Context, userID ...*uuid.UUID) ([]EvaluationStats, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	query := `SELECT eval_type, COALESCE(AVG(score), 0), COUNT(*)
		 FROM llm_evaluations`
	var args []interface{}
	if uid != nil {
		query += ` WHERE (user_id = $1 OR user_id IS NULL)`
		args = append(args, *uid)
	}
	query += ` GROUP BY eval_type ORDER BY eval_type`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []EvaluationStats
	for rows.Next() {
		var s EvaluationStats
		if err := rows.Scan(&s.EvalType, &s.AvgScore, &s.TotalCount); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}
