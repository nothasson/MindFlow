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

// CreateEvaluation 创建一条评估记录
func (r *EvaluationRepo) CreateEvaluation(ctx context.Context, evalType string, convID *uuid.UUID, score float64, details map[string]interface{}) error {
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		detailsJSON = []byte("{}")
	}

	_, err = r.pool.Exec(ctx,
		`INSERT INTO llm_evaluations (eval_type, conversation_id, score, details)
		 VALUES ($1, $2, $3, $4)`,
		evalType, convID, score, detailsJSON,
	)
	return err
}

// GetEvaluationStats 获取指定类型的评估统计（平均分、总次数）
func (r *EvaluationRepo) GetEvaluationStats(ctx context.Context, evalType string) (*EvaluationStats, error) {
	var stats EvaluationStats
	stats.EvalType = evalType

	err := r.pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(score), 0), COUNT(*) FROM llm_evaluations WHERE eval_type = $1`,
		evalType,
	).Scan(&stats.AvgScore, &stats.TotalCount)
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// GetAllStats 获取所有评估类型的统计
func (r *EvaluationRepo) GetAllStats(ctx context.Context) ([]EvaluationStats, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT eval_type, COALESCE(AVG(score), 0), COUNT(*)
		 FROM llm_evaluations
		 GROUP BY eval_type
		 ORDER BY eval_type`,
	)
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
