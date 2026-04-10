package config

import "os"

type Config struct {
	// 服务端口
	Port string

	// LLM 配置
	LLMAPIKey  string
	LLMBaseURL string
	LLMModel   string

	// 数据库
	PostgresDSN string
	RedisAddr   string
	QdrantAddr  string

	// AI 微服务
	AIServiceAddr string

	// 文件存储
	MemoryDir     string
	UploadDir     string
	MigrationsDir string

	// Codex (OAuth)
	CodexModel string

	// CORS
	CORSOrigins string
}

func Load() *Config {
	return &Config{
		Port:          getEnv("BACKEND_PORT", "8080"),
		LLMAPIKey:     getEnv("LLM_API_KEY", ""),
		LLMBaseURL:    getEnv("LLM_BASE_URL", "https://api.siliconflow.cn/v1"),
		LLMModel:      getEnv("LLM_MODEL", "Pro/MiniMaxAI/MiniMax-M2.5"),
		PostgresDSN:   getEnv("POSTGRES_DSN", ""),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		QdrantAddr:    getEnv("QDRANT_ADDR", "localhost:6334"),
		CodexModel:    getEnv("CODEX_MODEL", "gpt-5.4"),
		AIServiceAddr: getEnv("AI_SERVICE_ADDR", "localhost:8000"),
		MemoryDir:     getEnv("MEMORY_DIR", "/data/memory"),
		UploadDir:     getEnv("UPLOAD_DIR", "/data/uploads"),
		MigrationsDir: getEnv("MIGRATIONS_DIR", "./migrations"),
		CORSOrigins:   getEnv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
