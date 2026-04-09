package main

import (
	"context"
	"log"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/hertz-contrib/cors"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/config"
	"github.com/nothasson/MindFlow/backend/internal/handler"
	"github.com/nothasson/MindFlow/backend/internal/llm"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化 LLM 客户端
	ctx := context.Background()
	chatModel, err := llm.NewChatModel(ctx, cfg)
	if err != nil {
		log.Fatalf("初始化 LLM 客户端失败: %v", err)
	}

	// 初始化 Agent
	tutor := agent.NewTutorAgent(chatModel)

	// 初始化 Handler
	chatHandler := handler.NewChatHandler(tutor)

	// 创建 Hertz 服务器
	h := server.Default(server.WithHostPorts(":" + cfg.Port))

	// CORS 中间件
	h.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// 路由
	h.GET("/health", func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, utils.H{"status": "ok", "service": "mindflow-backend"})
	})

	h.POST("/api/chat", func(ctx context.Context, c *app.RequestContext) {
		chatHandler.Handle(ctx, c)
	})

	log.Printf("MindFlow Backend 启动在 :%s", cfg.Port)
	h.Spin()
}
