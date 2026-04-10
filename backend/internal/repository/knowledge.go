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
	ID           string `json:"id"`
	FromConcept  string `json:"from"`
	RelationType string `json:"relation_type"`
	ToConcept    string `json:"to"`
}

// ExtractedKnowledgePoint 资料解析后提取出的知识点。
type ExtractedKnowledgePoint struct {
	Concept       string
	Description   string
	Prerequisites []string
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

// UpsertExtractedPoints 写入资料提取出的知识点及前置关系。
func (r *KnowledgeRepo) UpsertExtractedPoints(ctx context.Context, points []ExtractedKnowledgePoint) error {
	for _, point := range points {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO knowledge_mastery (concept, confidence, updated_at)
			VALUES ($1, 0.0, NOW())
			ON CONFLICT (concept)
			DO UPDATE SET updated_at = NOW()
		`, point.Concept); err != nil {
			return err
		}

		for _, prerequisite := range point.Prerequisites {
			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_mastery (concept, confidence, updated_at)
				VALUES ($1, 0.0, NOW())
				ON CONFLICT (concept)
				DO UPDATE SET updated_at = NOW()
			`, prerequisite); err != nil {
				return err
			}

			if _, err := r.pool.Exec(ctx, `
				INSERT INTO knowledge_relations (from_concept, relation_type, to_concept)
				VALUES ($1, 'prerequisite', $2)
				ON CONFLICT (from_concept, relation_type, to_concept)
				DO NOTHING
			`, point.Concept, prerequisite); err != nil {
				return err
			}
		}
	}
	return nil
}

// ReviewItem 复习项
type ReviewItem struct {
	ID             string    `json:"id"`
	Concept        string    `json:"concept"`
	Confidence     float64   `json:"confidence"`
	EasinessFactor float64   `json:"easiness_factor"`
	IntervalDays   int       `json:"interval_days"`
	Repetitions    int       `json:"repetitions"`
	NextReview     time.Time `json:"next_review"`
	LastReviewed   time.Time `json:"last_reviewed"`
}

// GetDueForReview 获取今日到期的复习项
func (r *KnowledgeRepo) GetDueForReview(ctx context.Context) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE next_review <= NOW() ORDER BY next_review ASC LIMIT 50`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// GetUpcomingReview 获取未来 N 天内到期的复习项
func (r *KnowledgeRepo) GetUpcomingReview(ctx context.Context, days int) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE next_review > NOW() AND next_review <= NOW() + make_interval(days => $1)
		 ORDER BY next_review ASC LIMIT 50`,
		days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// GetWeakPoints 获取薄弱知识点（confidence < 0.5，按 confidence 升序）
func (r *KnowledgeRepo) GetWeakPoints(ctx context.Context, limit int) ([]ReviewItem, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, confidence, easiness_factor, interval_days, repetitions, next_review, last_reviewed
		 FROM knowledge_mastery WHERE confidence < 0.5 ORDER BY confidence ASC LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ReviewItem
	for rows.Next() {
		var item ReviewItem
		if err := rows.Scan(&item.ID, &item.Concept, &item.Confidence, &item.EasinessFactor,
			&item.IntervalDays, &item.Repetitions, &item.NextReview, &item.LastReviewed); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}
