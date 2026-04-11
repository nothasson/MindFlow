package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nothasson/MindFlow/backend/internal/model"
)

// UserRepo 用户数据访问
type UserRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo 创建用户仓库
func NewUserRepo(db *DB) *UserRepo {
	return &UserRepo{pool: db.Pool}
}

// CreateUser 创建用户
func (r *UserRepo) CreateUser(ctx context.Context, email, passwordHash, displayName string) (*model.User, error) {
	var user model.User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, display_name)
		 VALUES ($1, $2, $3)
		 RETURNING id, email, password_hash, display_name, created_at, updated_at`,
		email, passwordHash, displayName,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail 按邮箱获取用户
func (r *UserRepo) GetUserByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByID 按 ID 获取用户
func (r *UserRepo) GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, display_name, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
