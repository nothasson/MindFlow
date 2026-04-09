package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// MessageRepo 消息数据访问
type MessageRepo struct {
	pool *pgxpool.Pool
}

// NewMessageRepo 创建消息仓库
func NewMessageRepo(db *DB) *MessageRepo {
	return &MessageRepo{pool: db.Pool}
}

// Create 创建消息
func (r *MessageRepo) Create(ctx context.Context, conversationID uuid.UUID, role, content string) (*model.Message, error) {
	var msg model.Message
	err := r.pool.QueryRow(ctx,
		`INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, conversation_id, role, content, created_at`,
		conversationID, role, content,
	).Scan(&msg.ID, &msg.ConversationID, &msg.Role, &msg.Content, &msg.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

// GetByConversationID 获取会话的所有消息（按时间升序）
func (r *MessageRepo) GetByConversationID(ctx context.Context, conversationID uuid.UUID) ([]model.Message, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []model.Message
	for rows.Next() {
		var msg model.Message
		if err := rows.Scan(&msg.ID, &msg.ConversationID, &msg.Role, &msg.Content, &msg.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, msg)
	}
	return msgs, nil
}
