package main

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/utils"
	"github.com/hertz-contrib/cors"

	"github.com/nothasson/MindFlow/backend/internal/agent"
	"github.com/nothasson/MindFlow/backend/internal/config"
	"github.com/nothasson/MindFlow/backend/internal/handler"
	"github.com/nothasson/MindFlow/backend/internal/llm"
	"github.com/nothasson/MindFlow/backend/internal/memory"
	"github.com/nothasson/MindFlow/backend/internal/repository"
	"github.com/nothasson/MindFlow/backend/internal/service"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 初始化数据库
	db, err := repository.NewDB(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer db.Close()
	log.Println("数据库连接成功")

	// 自动执行数据库迁移
	migrationsDir := cfg.MigrationsDir
	if err := db.Migrate(ctx, migrationsDir); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	// 初始化 Repository
	convRepo := repository.NewConversationRepo(db)
	msgRepo := repository.NewMessageRepo(db)
	resourceRepo := repository.NewResourceRepo(db)

	// 初始化 LLM 客户端
	chatModel, err := llm.NewChatModel(ctx, cfg)
	if err != nil {
		log.Fatalf("初始化 LLM 客户端失败: %v", err)
	}

	// 初始化 AI 微服务客户端
	aiClient := service.NewAIClient("http://" + cfg.AIServiceAddr)
	if err := aiClient.Health(); err != nil {
		log.Printf("警告: AI 微服务不可达 (%s)，Content Agent 将不可用", err)
		aiClient = nil
	} else {
		log.Println("AI 微服务连接成功")
	}

	// 初始化 Agent
	tutor := agent.NewTutorAgent(chatModel)
	orchestrator := agent.NewOrchestrator(chatModel, tutor)

	// 注入 Content Agent（如果 AI 微服务可用）
	if aiClient != nil {
		content := agent.NewContentAgent(chatModel, aiClient)
		orchestrator.SetContentAgent(content)
		log.Println("Content Agent 已启用")
	}

	// 初始化记忆系统和 Dreaming Sweep
	var memHandler *handler.MemoryHandler
	memStore, err := memory.NewStore(cfg.MemoryDir)
	if err != nil {
		log.Printf("警告: 记忆系统初始化失败: %v", err)
	} else {
		memAgent := agent.NewMemoryAgent(chatModel, memStore)
		orchestrator.SetMemoryAgent(memAgent)
		log.Println("记忆系统已启用")

		memHandler = handler.NewMemoryHandler(memStore)

		// 启动 Dreaming Sweep 每日定时任务
		sweep := memory.NewDreamingSweep(memStore, chatModel)
		go runDreamingSweep(ctx, sweep)
	}

	// 初始化 Repository（知识图谱）
	knowledgeRepo := repository.NewKnowledgeRepo(db)
	courseRepo := repository.NewCourseRepo(db)

	// 初始化课程生成 Agent
	courseware := agent.NewCoursewareAgent(chatModel)

	// 初始化 Handler
	chatHandler := handler.NewChatHandler(orchestrator, convRepo, msgRepo)
	convHandler := handler.NewConversationHandler(convRepo, msgRepo)
	resourceHandler := handler.NewResourceHandler(aiClient, resourceRepo, knowledgeRepo)
	knowledgeHandler := handler.NewKnowledgeHandler(knowledgeRepo)
	courseHandler := handler.NewCourseHandler(courseRepo, resourceRepo, courseware)
	dashboardHandler := handler.NewDashboardHandler(convRepo, msgRepo, resourceRepo, courseRepo)

	// 创建 Hertz 服务器
	h := server.Default(
		server.WithHostPorts(":"+cfg.Port),
		server.WithMaxRequestBodySize(100*1024*1024), // 100MB
	)

	// CORS 中间件（从配置读取允许的 origins）
	corsOrigins := strings.Split(cfg.CORSOrigins, ",")
	h.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
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

	// 资料上传路由
	h.POST("/api/resources/upload", func(ctx context.Context, c *app.RequestContext) {
		resourceHandler.Upload(ctx, c)
	})
	h.POST("/api/resources/import-url", func(ctx context.Context, c *app.RequestContext) {
		resourceHandler.ImportURL(ctx, c)
	})

	// 知识图谱路由
	h.GET("/api/knowledge/graph", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.Graph(ctx, c)
	})

	// 记忆系统路由
	if memHandler != nil {
		h.GET("/api/memory/profile", func(ctx context.Context, c *app.RequestContext) {
			memHandler.Profile(ctx, c)
		})
		h.GET("/api/memory/timeline", func(ctx context.Context, c *app.RequestContext) {
			memHandler.Timeline(ctx, c)
		})
		h.GET("/api/memory/search", func(ctx context.Context, c *app.RequestContext) {
			memHandler.Search(ctx, c)
		})
	}

	// 开发测试：回声接口，逐字流式返回用户内容，用于测试 Markdown/Mermaid 渲染和打字机效果
	h.POST("/api/echo", func(ctx context.Context, c *app.RequestContext) {
		handler.HandleEcho(ctx, c)
	})

	// 课程管理路由
	h.POST("/api/resources/:id/generate-course", func(ctx context.Context, c *app.RequestContext) {
		courseHandler.GenerateFromResource(ctx, c)
	})
	h.GET("/api/courses", func(ctx context.Context, c *app.RequestContext) {
		courseHandler.List(ctx, c)
	})
	h.GET("/api/courses/:id", func(ctx context.Context, c *app.RequestContext) {
		courseHandler.GetByID(ctx, c)
	})
	h.DELETE("/api/courses/:id", func(ctx context.Context, c *app.RequestContext) {
		courseHandler.Delete(ctx, c)
	})

	// 仪表盘路由
	h.GET("/api/dashboard/stats", func(ctx context.Context, c *app.RequestContext) {
		dashboardHandler.Stats(ctx, c)
	})

	log.Printf("MindFlow Backend 启动在 :%s", cfg.Port)
	h.Spin()
}

// runDreamingSweep 每日凌晨 3 点执行 Dreaming Sweep
func runDreamingSweep(ctx context.Context, sweep *memory.DreamingSweep) {
	for {
		now := time.Now()
		// 计算下一个凌晨 3:00（如果今天 3:00 还没过，就用今天的）
		next := time.Date(now.Year(), now.Month(), now.Day(), 3, 0, 0, 0, now.Location())
		if !next.After(now) {
			next = next.AddDate(0, 0, 1)
		}
		duration := next.Sub(now)

		log.Printf("Dreaming Sweep 将在 %s 后执行（%s）", duration.Round(time.Minute), next.Format("2006-01-02 15:04"))

		timer := time.NewTimer(duration)
		select {
		case <-ctx.Done():
			timer.Stop()
			log.Println("Dreaming Sweep 已停止")
			return
		case <-timer.C:
		}

		// 整理昨天的日志
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		log.Printf("开始执行 Dreaming Sweep: %s", yesterday)

		if err := sweep.Run(ctx, yesterday); err != nil {
			log.Printf("Dreaming Sweep 失败: %v", err)
		} else {
			log.Printf("Dreaming Sweep 完成: %s", yesterday)
		}
	}
}
