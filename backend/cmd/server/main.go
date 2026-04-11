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
	userRepo := repository.NewUserRepo(db)

	// 初始化 LLM ModelSwitch（支持多 provider 热切换）
	modelSwitch := llm.NewModelSwitch()

	// 注册硅基流动（默认 provider）
	siliconModel, err := llm.NewChatModel(ctx, cfg)
	if err != nil {
		log.Fatalf("初始化硅基流动 LLM 失败: %v", err)
	}
	modelSwitch.Register("siliconflow", "硅基流动", cfg.LLMModel, siliconModel)

	// 注册 Codex（可选，检测 token 文件）— 仅注册，不切换默认
	if llm.CodexIsAvailable() {
		codexModel := llm.NewCodexProvider(cfg.CodexModel)
		modelSwitch.Register("codex", "Codex", cfg.CodexModel, codexModel)
		log.Printf("Codex Provider 已注册 (模型: %s)，默认仍使用硅基流动", cfg.CodexModel)
	} else {
		log.Println("Codex Provider 未注册（未找到 token 文件），使用硅基流动")
	}

	// modelSwitch 实现了 model.ChatModel 接口，所有 Agent 透明使用
	chatModel := modelSwitch

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
	sourceLinkRepo := repository.NewSourceLinkRepo(db)

	// 初始化课程生成 Agent
	courseware := agent.NewCoursewareAgent(chatModel)

	// 初始化 Handler
	// 注意：aiClient 为 nil 时必须传接口 nil 而非 typed nil，否则接口 nil 判断会失效
	var chatAI handler.ChatAIClient
	if aiClient != nil {
		chatAI = aiClient
	}
	chatHandler := handler.NewChatHandler(orchestrator, convRepo, msgRepo, knowledgeRepo, chatAI)
	convHandler := handler.NewConversationHandler(convRepo, msgRepo)
	resourceHandler := handler.NewResourceHandler(aiClient, resourceRepo, knowledgeRepo, chatModel)
	resourceHandler.SetSourceLinkWriter(sourceLinkRepo)
	knowledgeHandler := handler.NewKnowledgeHandler(knowledgeRepo)
	knowledgeHandler.SetSourceLinkRepo(sourceLinkRepo)
	if aiClient != nil {
		knowledgeHandler.SetAIClient(aiClient)
	}
	courseHandler := handler.NewCourseHandler(courseRepo, resourceRepo, courseware)
	dashboardHandler := handler.NewDashboardHandler(convRepo, msgRepo, resourceRepo, courseRepo, knowledgeRepo)
	reviewHandler := handler.NewReviewHandler(knowledgeRepo)
	memoryPageHandler := handler.NewMemoryPageHandler(convRepo, msgRepo, knowledgeRepo)
	quizRepo := repository.NewQuizRepo(db)
	quizHandler := handler.NewQuizHandler(agent.NewQuizAgent(chatModel), agent.NewVariantQuizAgent(chatModel), knowledgeRepo, quizRepo)
	quizHandler.SetSourceLinkRepo(sourceLinkRepo)
	wrongBookHandler := handler.NewWrongBookHandler(quizRepo)

	// 初始化考试计划 Handler
	examRepo := repository.NewExamRepo(db)
	examHandler := handler.NewExamHandler(examRepo)

	// 初始化 LLM 评估 Handler
	evalRepo := repository.NewEvaluationRepo(db)
	evalHandler := handler.NewEvaluationHandler(evalRepo)

	// 注入评估依赖到 ChatHandler（异步评估对话质量）
	chatHandler.SetEvaluation(evalRepo, chatModel)

	// 初始化晨间简报 Handler
	curriculumAgent := agent.NewCurriculumAgent(chatModel)
	briefingHandler := handler.NewBriefingHandler(knowledgeRepo, quizRepo, convRepo, curriculumAgent)

	// 创建 Hertz 服务器
	h := server.Default(
		server.WithHostPorts(":"+cfg.Port),
		server.WithMaxRequestBodySize(100*1024*1024), // 100MB
	)

	// CORS 中间件（从配置读取允许的 origins）
	rawOrigins := strings.Split(cfg.CORSOrigins, ",")
	var corsOrigins []string
	for _, o := range rawOrigins {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			corsOrigins = append(corsOrigins, trimmed)
		}
	}
	h.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	// 路由
	h.GET("/health", func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, utils.H{"status": "ok", "service": "mindflow-backend"})
	})

	// 认证路由（无需 JWT 中间件）
	authHandler := handler.NewAuthHandler(userRepo, cfg.JWTSecret)
	authGroup := h.Group("/api/auth")
	authGroup.POST("/register", func(ctx context.Context, c *app.RequestContext) {
		authHandler.Register(ctx, c)
	})
	authGroup.POST("/login", func(ctx context.Context, c *app.RequestContext) {
		authHandler.Login(ctx, c)
	})
	authGroup.GET("/me", handler.JWTAuth(cfg.JWTSecret), func(ctx context.Context, c *app.RequestContext) {
		authHandler.Me(ctx, c)
	})

	// Provider 设置 API
	h.GET("/api/settings/provider", func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, utils.H{
			"active":    modelSwitch.Active(),
			"providers": modelSwitch.Providers(),
		})
	})
	h.PUT("/api/settings/provider", handler.JWTAuth(cfg.JWTSecret), func(ctx context.Context, c *app.RequestContext) {
		var req struct {
			Provider string `json:"provider"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, utils.H{"error": "请求格式错误"})
			return
		}
		if err := modelSwitch.SetActive(req.Provider); err != nil {
			c.JSON(400, utils.H{"error": err.Error()})
			return
		}
		log.Printf("LLM Provider 切换为: %s", req.Provider)
		c.JSON(200, utils.H{"active": req.Provider})
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
	h.DELETE("/api/knowledge/concept/:name", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.DeleteConcept(ctx, c)
	})
	h.GET("/api/knowledge/prerequisite-chain", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.PrerequisiteChain(ctx, c)
	})
	h.GET("/api/knowledge/learning-path", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.LearningPath(ctx, c)
	})
	h.GET("/api/knowledge/sources", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.Sources(ctx, c)
	})
	h.GET("/api/knowledge/search", func(ctx context.Context, c *app.RequestContext) {
		knowledgeHandler.SemanticSearch(ctx, c)
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

	// 记忆页数据路由
	h.GET("/api/conversations/recent", func(ctx context.Context, c *app.RequestContext) {
		memoryPageHandler.RecentConversations(ctx, c)
	})
	h.GET("/api/knowledge/recent", func(ctx context.Context, c *app.RequestContext) {
		memoryPageHandler.KnowledgeRecent(ctx, c)
	})
	h.GET("/api/stats/calendar", func(ctx context.Context, c *app.RequestContext) {
		memoryPageHandler.CalendarStats(ctx, c)
	})

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
	h.GET("/api/dashboard/heatmap", func(ctx context.Context, c *app.RequestContext) {
		dashboardHandler.Heatmap(ctx, c)
	})
	h.GET("/api/dashboard/mastery-distribution", func(ctx context.Context, c *app.RequestContext) {
		dashboardHandler.MasteryDistribution(ctx, c)
	})

	// 复习计划路由
	h.GET("/api/review/due", func(ctx context.Context, c *app.RequestContext) {
		reviewHandler.Due(ctx, c)
	})
	h.GET("/api/review/upcoming", func(ctx context.Context, c *app.RequestContext) {
		reviewHandler.Upcoming(ctx, c)
	})

	// 答题路由
	h.POST("/api/quiz/generate", func(ctx context.Context, c *app.RequestContext) {
		quizHandler.Generate(ctx, c)
	})
	h.POST("/api/quiz/submit", func(ctx context.Context, c *app.RequestContext) {
		quizHandler.Submit(ctx, c)
	})
	h.POST("/api/quiz/variant", func(ctx context.Context, c *app.RequestContext) {
		quizHandler.GenerateVariant(ctx, c)
	})
	h.POST("/api/quiz/anki-rate", func(ctx context.Context, c *app.RequestContext) {
		quizHandler.AnkiRate(ctx, c)
	})

	// 错题本路由
	h.GET("/api/wrongbook", func(ctx context.Context, c *app.RequestContext) {
		wrongBookHandler.List(ctx, c)
	})
	h.GET("/api/wrongbook/stats", func(ctx context.Context, c *app.RequestContext) {
		wrongBookHandler.Stats(ctx, c)
	})
	h.POST("/api/wrongbook/:id/review", func(ctx context.Context, c *app.RequestContext) {
		wrongBookHandler.MarkReviewed(ctx, c)
	})
	h.DELETE("/api/wrongbook/:id", func(ctx context.Context, c *app.RequestContext) {
		wrongBookHandler.Delete(ctx, c)
	})

	// 考试计划路由
	h.POST("/api/exam-plans", func(ctx context.Context, c *app.RequestContext) {
		examHandler.Create(ctx, c)
	})
	h.GET("/api/exam-plans", func(ctx context.Context, c *app.RequestContext) {
		examHandler.List(ctx, c)
	})
	h.DELETE("/api/exam-plans/:id", func(ctx context.Context, c *app.RequestContext) {
		examHandler.Delete(ctx, c)
	})

	// 对话式考察路由
	h.POST("/api/quiz/conversation", func(ctx context.Context, c *app.RequestContext) {
		quizHandler.ConversationalQuiz(ctx, c)
	})

	// 晨间简报路由
	h.GET("/api/daily-briefing", func(ctx context.Context, c *app.RequestContext) {
		briefingHandler.GetBriefing(ctx, c)
	})

	// LLM 评估路由
	h.GET("/api/evaluations/stats", func(ctx context.Context, c *app.RequestContext) {
		evalHandler.Stats(ctx, c)
	})
	h.POST("/api/evaluations", func(ctx context.Context, c *app.RequestContext) {
		evalHandler.Create(ctx, c)
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
