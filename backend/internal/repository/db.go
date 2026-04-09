package repository

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"

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

// Migrate 自动执行 migrations 目录下的 SQL 文件
func (db *DB) Migrate(ctx context.Context, migrationsDir string) error {
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil {
		return fmt.Errorf("读取迁移目录失败: %w", err)
	}
	sort.Strings(files)

	for _, f := range files {
		sql, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("读取迁移文件 %s 失败: %w", f, err)
		}
		if _, err := db.Pool.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("执行迁移 %s 失败: %w", filepath.Base(f), err)
		}
		log.Printf("迁移完成: %s", filepath.Base(f))
	}
	return nil
}

// Close 关闭连接池
func (db *DB) Close() {
	db.Pool.Close()
}
