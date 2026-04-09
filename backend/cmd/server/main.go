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
	"github.com/nothasson/MindFlow/backend/internal/repository"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	// 初始化数据库
	db, err := repository.NewDB(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer db.Close()
	log.Println("数据库连接成功")

	// 初始化 Repository
	convRepo := repository.NewConversationRepo(db)
	msgRepo := repository.NewMessageRepo(db)

	// 初始化 LLM 客户端
	chatModel, err := llm.NewChatModel(ctx, cfg)
	if err != nil {
		log.Fatalf("初始化 LLM 客户端失败: %v", err)
	}

	// 初始化 Agent
	tutor := agent.NewTutorAgent(chatModel)
	orchestrator := agent.NewOrchestrator(chatModel, tutor)

	// 初始化 Handler
	chatHandler := handler.NewChatHandler(orchestrator, convRepo, msgRepo)
	convHandler := handler.NewConversationHandler(convRepo, msgRepo)

	// 创建 Hertz 服务器
	h := server.Default(server.WithHostPorts(":" + cfg.Port))

	// CORS 中间件
	h.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "DELETE", "OPTIONS"},
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

	// 会话管理路由
	h.POST("/api/conversations", func(ctx context.Context, c *app.RequestContext) {
		convHandler.Create(ctx, c)
	})
	h.GET("/api/conversations", func(ctx context.Context, c *app.RequestContext) {
		convHandler.List(ctx, c)
	})
	h.GET("/api/conversations/:id", func(ctx context.Context, c *app.RequestContext) {
		convHandler.GetByID(ctx, c)
	})
	h.DELETE("/api/conversations/:id", func(ctx context.Context, c *app.RequestContext) {
		convHandler.Delete(ctx, c)
	})

	log.Printf("MindFlow Backend 启动在 :%s", cfg.Port)
	h.Spin()
}
