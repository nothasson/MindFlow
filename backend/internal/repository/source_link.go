package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// SourceLinkRepo 知识点来源关联数据访问
type SourceLinkRepo struct {
	pool *pgxpool.Pool
}

// NewSourceLinkRepo 创建来源关联仓库
func NewSourceLinkRepo(db *DB) *SourceLinkRepo {
	return &SourceLinkRepo{pool: db.Pool}
}

// CreateLink 创建知识点与来源的关联（userID 可为 nil）
func (r *SourceLinkRepo) CreateLink(ctx context.Context, concept, sourceType string, sourceID uuid.UUID, position string, userID ...*uuid.UUID) error {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	_, err := r.pool.Exec(ctx,
		`INSERT INTO knowledge_source_links (concept, source_type, source_id, page_or_position, user_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		concept, sourceType, sourceID, position, uid,
	)
	return err
}

// GetLinksByConcept 查询某个知识点的所有来源（userID 可选，用于按用户过滤）
func (r *SourceLinkRepo) GetLinksByConcept(ctx context.Context, concept string, userID ...*uuid.UUID) ([]model.KnowledgeSourceLink, error) {
	query := `SELECT id, concept, source_type, source_id, page_or_position, created_at
		 FROM knowledge_source_links
		 WHERE concept = $1`
	args := []interface{}{concept}

	if len(userID) > 0 && userID[0] != nil {
		query += ` AND user_id = $2`
		args = append(args, *userID[0])
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []model.KnowledgeSourceLink
	for rows.Next() {
		var l model.KnowledgeSourceLink
		if err := rows.Scan(&l.ID, &l.Concept, &l.SourceType, &l.SourceID, &l.PageOrPosition, &l.CreatedAt); err != nil {
			return nil, err
		}
		links = append(links, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return links, nil
}

// GetLinksBySource 查询某个来源关联的所有知识点
func (r *SourceLinkRepo) GetLinksBySource(ctx context.Context, sourceType string, sourceID uuid.UUID) ([]model.KnowledgeSourceLink, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, concept, source_type, source_id, page_or_position, created_at
		 FROM knowledge_source_links
		 WHERE source_type = $1 AND source_id = $2
		 ORDER BY created_at DESC`,
		sourceType, sourceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []model.KnowledgeSourceLink
	for rows.Next() {
		var l model.KnowledgeSourceLink
		if err := rows.Scan(&l.ID, &l.Concept, &l.SourceType, &l.SourceID, &l.PageOrPosition, &l.CreatedAt); err != nil {
			return nil, err
		}
		links = append(links, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return links, nil
}
