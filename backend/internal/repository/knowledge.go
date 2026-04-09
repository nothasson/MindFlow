package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// KnowledgeNode 知识点节点
type KnowledgeNode struct {
	ID             string    `json:"id"`
	Concept        string    `json:"concept"`
	Confidence     float64   `json:"confidence"`
	ErrorType      *string   `json:"error_type,omitempty"`
	EasinessFactor float64   `json:"easiness_factor"`
	IntervalDays   int       `json:"interval_days"`
	Repetitions    int       `json:"repetitions"`
	LastReviewed   time.Time `json:"last_reviewed"`
	NextReview     time.Time `json:"next_review"`
}

// KnowledgeEdge 知识点关系边
type KnowledgeEdge struct {
	ID           string  `json:"id"`
	FromConcept  string  `json:"from"`
	RelationType string  `json:"relation_type"`
	ToConcept    string  `json:"to"`
}

// KnowledgeRepo 知识图谱数据访问
type KnowledgeRepo struct {
	pool *pgxpool.Pool
}

// NewKnowledgeRepo 创建知识图谱仓库
func NewKnowledgeRepo(db *DB) *KnowledgeRepo {
	return &KnowledgeRepo{pool: db.Pool}
}

// ListNodes 获取所有知识点节点
func (r *KnowledgeRepo) ListNodes(ctx context.Context) ([]KnowledgeNode, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, error_type, easiness_factor, interval_days, repetitions, last_reviewed, next_review
		 FROM knowledge_mastery
		 ORDER BY concept`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []KnowledgeNode
	for rows.Next() {
		var n KnowledgeNode
		if err := rows.Scan(&n.ID, &n.Concept, &n.Confidence, &n.ErrorType, &n.EasinessFactor, &n.IntervalDays, &n.Repetitions, &n.LastReviewed, &n.NextReview); err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}
	return nodes, nil
}

// ListEdges 获取所有知识点关系
func (r *KnowledgeRepo) ListEdges(ctx context.Context) ([]KnowledgeEdge, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, from_concept, relation_type, to_concept
		 FROM knowledge_relations
		 WHERE valid_to IS NULL OR valid_to > NOW()
		 ORDER BY from_concept`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var edges []KnowledgeEdge
	for rows.Next() {
		var e KnowledgeEdge
		if err := rows.Scan(&e.ID, &e.FromConcept, &e.RelationType, &e.ToConcept); err != nil {
			return nil, err
		}
		edges = append(edges, e)
	}
	return edges, nil
}
