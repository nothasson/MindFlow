package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// ConversationRepo 会话数据访问
type ConversationRepo struct {
	pool *pgxpool.Pool
}

// NewConversationRepo 创建会话仓库
func NewConversationRepo(db *DB) *ConversationRepo {
	return &ConversationRepo{pool: db.Pool}
}

// Create 创建会话
func (r *ConversationRepo) Create(ctx context.Context, title string) (*model.Conversation, error) {
	var conv model.Conversation
	err := r.pool.QueryRow(ctx,
		`INSERT INTO conversations (title) VALUES ($1) RETURNING id, title, created_at, updated_at`,
		title,
	).Scan(&conv.ID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

// GetByID 按 ID 获取会话
func (r *ConversationRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Conversation, error) {
	var conv model.Conversation
	err := r.pool.QueryRow(ctx,
		`SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1`,
		id,
	).Scan(&conv.ID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

// List 获取会话列表（最近 20 条）
func (r *ConversationRepo) List(ctx context.Context) ([]model.Conversation, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 20`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []model.Conversation
	for rows.Next() {
		var conv model.Conversation
		if err := rows.Scan(&conv.ID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			return nil, err
		}
		convs = append(convs, conv)
	}
	return convs, nil
}

// UpdateTitle 更新会话标题
func (r *ConversationRepo) UpdateTitle(ctx context.Context, id uuid.UUID, title string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
		title, id,
	)
	return err
}

// TouchUpdatedAt 更新会话时间戳
func (r *ConversationRepo) TouchUpdatedAt(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
		id,
	)
	return err
}

// Delete 删除会话
func (r *ConversationRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM conversations WHERE id = $1`,
		id,
	)
	return err
}

// Count 获取会话总数
func (r *ConversationRepo) Count(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM conversations`).Scan(&count)
	return count, err
}

// CountDistinctDays 获取有会话的不同日期数
func (r *ConversationRepo) CountDistinctDays(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT DATE(created_at)) FROM conversations`).Scan(&count)
	return count, err
}

// GetActiveDays 获取最近 N 天内有会话的日期列表
func (r *ConversationRepo) GetActiveDays(ctx context.Context, days int) ([]string, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT DISTINCT DATE(created_at) as day FROM conversations
		 WHERE created_at >= NOW() - make_interval(days => $1)
		 ORDER BY day DESC`,
		days,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []string
	for rows.Next() {
		var d interface{}
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		switch v := d.(type) {
		case time.Time:
			result = append(result, v.Format("2006-01-02"))
		}
	}
	return result, nil
}
