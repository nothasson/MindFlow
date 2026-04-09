package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB 数据库连接池
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB 创建数据库连接池
func NewDB(ctx context.Context, dsn string) (*DB, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("数据库 ping 失败: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close 关闭连接池
func (db *DB) Close() {
	db.Pool.Close()
}
