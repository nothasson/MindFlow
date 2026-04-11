package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// ResourceRepo 学习资料数据访问。
type ResourceRepo struct {
	pool *pgxpool.Pool
}

// NewResourceRepo 创建学习资料仓库。
func NewResourceRepo(db *DB) *ResourceRepo {
	return &ResourceRepo{pool: db.Pool}
}

// Create 创建资料记录。
// userID 可为 nil，表示无登录状态
func (r *ResourceRepo) Create(ctx context.Context, resource *model.Resource, userID ...*uuid.UUID) (*model.Resource, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var created model.Resource
	err := r.pool.QueryRow(ctx, `
		INSERT INTO resources (
			source_type, title, original_filename, source_url, content_text, pages, chunk_count, status, user_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, source_type, title, original_filename, source_url, content_text, pages, chunk_count, status, created_at, updated_at
	`,
		resource.SourceType,
		resource.Title,
		resource.OriginalFilename,
		resource.SourceURL,
		resource.ContentText,
		resource.Pages,
		resource.ChunkCount,
		resource.Status,
		uid,
	).Scan(
		&created.ID,
		&created.SourceType,
		&created.Title,
		&created.OriginalFilename,
		&created.SourceURL,
		&created.ContentText,
		&created.Pages,
		&created.ChunkCount,
		&created.Status,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &created, nil
}

// UpdateStatus 更新处理状态和分块数。
func (r *ResourceRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string, chunkCount int) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE resources
		SET status = $1, chunk_count = $2, updated_at = NOW()
		WHERE id = $3
	`, status, chunkCount, id)
	return err
}

// GetByID 按 ID 获取资料（userID 非 nil 时校验归属）
func (r *ResourceRepo) GetByID(ctx context.Context, id uuid.UUID, userID ...*uuid.UUID) (*model.Resource, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var res model.Resource
	var err error
	if uid != nil {
		err = r.pool.QueryRow(ctx, `
			SELECT id, source_type, title, original_filename, source_url, content_text, pages, chunk_count, status, summary, questions, created_at, updated_at
			FROM resources WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
		`, id, *uid).Scan(
			&res.ID, &res.SourceType, &res.Title, &res.OriginalFilename, &res.SourceURL,
			&res.ContentText, &res.Pages, &res.ChunkCount, &res.Status, &res.Summary, &res.Questions, &res.CreatedAt, &res.UpdatedAt,
		)
	} else {
		err = r.pool.QueryRow(ctx, `
			SELECT id, source_type, title, original_filename, source_url, content_text, pages, chunk_count, status, summary, questions, created_at, updated_at
			FROM resources WHERE id = $1
		`, id).Scan(
			&res.ID, &res.SourceType, &res.Title, &res.OriginalFilename, &res.SourceURL,
			&res.ContentText, &res.Pages, &res.ChunkCount, &res.Status, &res.Summary, &res.Questions, &res.CreatedAt, &res.UpdatedAt,
		)
	}
	if err != nil {
		return nil, err
	}
	return &res, nil
}

// List 获取资料列表
// userID 可为 nil，表示不按用户过滤
func (r *ResourceRepo) List(ctx context.Context, userID ...*uuid.UUID) ([]model.Resource, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	query := `SELECT id, source_type, title, original_filename, source_url, content_text, pages, chunk_count, status, summary, questions, created_at, updated_at
		FROM resources`
	var args []interface{}
	if uid != nil {
		query += ` WHERE (user_id = $1 OR user_id IS NULL)`
		args = append(args, *uid)
	}
	query += ` ORDER BY created_at DESC LIMIT 50`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var resources []model.Resource
	for rows.Next() {
		var res model.Resource
		if err := rows.Scan(
			&res.ID, &res.SourceType, &res.Title, &res.OriginalFilename, &res.SourceURL,
			&res.ContentText, &res.Pages, &res.ChunkCount, &res.Status, &res.Summary, &res.Questions, &res.CreatedAt, &res.UpdatedAt,
		); err != nil {
			return nil, err
		}
		resources = append(resources, res)
	}
	return resources, nil
}

// Delete 删除资料
// userID 必填，用于防止跨用户删除
func (r *ResourceRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM resources
		WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
	`, id, userID)
	return err
}

// Count 获取资料总数
// userID 可为 nil，表示不按用户过滤
func (r *ResourceRepo) Count(ctx context.Context, userID ...*uuid.UUID) (int, error) {
	var uid *uuid.UUID
	if len(userID) > 0 {
		uid = userID[0]
	}

	var count int
	if uid != nil {
		err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM resources WHERE (user_id = $1 OR user_id IS NULL)`, *uid).Scan(&count)
		return count, err
	}
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM resources`).Scan(&count)
	return count, err
}

// UpdateOverview 保存资料摘要和建议学习问题。
func (r *ResourceRepo) UpdateOverview(ctx context.Context, id uuid.UUID, summary string, questions []string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE resources
		SET summary = $1, questions = $2, updated_at = NOW()
		WHERE id = $3
	`, summary, questions, id)
	return err
}
