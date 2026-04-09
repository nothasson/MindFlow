# MindFlow - AI Native 自适应学习平台设计文档

> 日期：2026-04-09
> 状态：设计阶段

## 一、产品定位

AI Native 的自适应学习平台。学生上传学习资料，AI 深度理解内容后，**主动规划学习路径、苏格拉底式引导教学、诊断薄弱点、基于遗忘曲线安排复习**。

核心区别于现有 AI 学习工具：不是问答机，是一个有记忆、会主动驱动学习节奏的私人导师。

## 二、核心设计原则

1. **AI Native** — AI 不是附加功能，是产品的核心交互方式
2. **不给答案** — 苏格拉底式引导，让学生自己推导
3. **有记忆** — 跨 session 记住学生的一切学习状态
4. **AI 主动驱动** — AI 决定今天学什么、复习什么，学生跟着走
5. **测试驱动** — TDD 开发，所有核心逻辑先写测试

## 三、技术栈

```
前端:  TypeScript + Next.js + Tailwind CSS
后端:  Go + Eino (Agent 编排) + Hertz (HTTP/WebSocket)
AI 服务: Python + FastAPI (文档解析/知识图谱/Embedding)
数据库: PostgreSQL (结构化) + Qdrant (向量) + Redis (缓存/调度)
部署:  Docker + Docker Compose (一键部署所有服务)
测试:  Go: testing + testify | TS: Vitest + Playwright | Python: pytest
```

### 为什么这样选

- **Go + Eino**：核心 Agent 编排，入职公司技术栈，借此学习
- **Python 微服务**：AI/ML 生态最丰富，文档解析/Embedding/知识图谱不在 Go 中重造轮子
- **Next.js**：SSR + API Routes，前后端一体化，适合 AI Native 产品

## 四、核心用户旅程

```
1. 上传资料（PDF/文档/网页链接）
      |
2. AI 自动解析 -> 提取知识点 -> 构建知识图谱
      |
3. AI 主动说："我分析了你的资料，建议从 X 概念开始，准备好了吗？"
      |
4. 苏格拉底式教学对话
   - AI 提问引导，不直接给答案
   - 学生回答 -> AI 诊断（概念错/方法错/粗心）
   - 针对性追问或补充前置知识
      |
5. 阶段性出题检验
   - 基于资料和对话内容自动出题
   - 结果反馈到掌握度模型
      |
6. AI 更新学习画像
   - 哪些知识点已掌握、哪些薄弱
   - 下次登录时 AI 主动说："上次 Y 概念你还不太熟，今天先复习一下？"
      |
7. 遗忘曲线提醒
   - "你 3 天前学的 Z 概念快到复习时间了"
   - 自动生成复习题
```

## 五、多 Agent 架构

```
+----------------------------------------------+
|              Orchestrator (Eino)              |
|         主编排器，调度所有 Agent               |
+------+--------+--------+--------+-----------+
       |        |        |        |
  +----v--+ +---v---+ +--v--+ +--v---------+
  | Tutor | |Diagno-| |Memo-| |Curriculum  |
  | Agent | |stic   | |ry   | | Agent      |
  |       | |Agent  | |Agent| |            |
  +-------+ +-------+ +-----+ +------------+
       |        |        |        |
  +----v--+ +---v---+ +--v---+ +--v---------+
  |Content| |Quiz   | |Review| |Knowledge   |
  | Agent | |Agent  | |Agent | |Graph Svc   |
  +-------+ +-------+ +------+ +------------+
```

### Agent 职责表

| Agent | 职责 | 实现 | 语言 |
|-------|------|------|------|
| **Orchestrator** | 总调度：根据上下文决定调用哪个 Agent | Eino Graph | Go |
| **Tutor Agent** | 苏格拉底式教学对话，不给答案，追问引导 | Eino ChatModelAgent | Go |
| **Diagnostic Agent** | 分析学生回答，判断错误类型，输出诊断 | Eino ChatModelAgent | Go |
| **Memory Agent** | 维护学生画像：掌握度、薄弱点、学习偏好 | Eino + 文件系统 | Go |
| **Curriculum Agent** | AI 主动规划：今天学什么、复习什么 | Eino ChatModelAgent | Go |
| **Quiz Agent** | 基于资料和掌握度出题，批改，反馈 | Eino ChatModelAgent | Go |
| **Review Agent** | 遗忘曲线计算，生成复习计划和复习题 | Eino + SM-2 算法 | Go |
| **Content Agent** | 文档解析、知识点提取、总结生成 | FastAPI + LlamaParse | Python |
| **Knowledge Graph Svc** | 知识图谱构建和查询 | FastAPI + NetworkX | Python |

## 六、记忆系统（参考 OpenClaw）

借鉴 OpenClaw 的三层记忆架构，适配学习场景：

### 6.1 三层记忆

| 层级 | 存储 | 作用 | 类比 |
|------|------|------|------|
| **即时记忆** | Redis + 对话上下文 | 当前教学会话状态 | 工作记忆 |
| **短期记忆** | `memory/YYYY-MM-DD.md` | 每日学习记录、对话要点 | 日记 |
| **长期记忆** | `MEMORY.md` + PostgreSQL | 核心学习画像、掌握度、偏好 | 长期记忆 |

> **持久化说明**：Markdown 记忆文件通过 Docker volume（`mindflow-memory`）挂载到宿主机，容器重启数据不丢失。

### 6.2 记忆文件结构（参考 OpenClaw 的 Markdown 方式）

```
~/.mindflow/
├── config.json              # 全局配置
├── workspace/
│   ├── MEMORY.md            # 长期记忆（核心学习画像）
│   ├── memory/              # 每日学习日志
│   │   ├── 2026-04-09.md
│   │   └── 2026-04-08.md
│   ├── learnings/           # 从日志中提炼的学习总结
│   │   └── 2026-04-09.md
│   ├── knowledge/           # 上传资料的知识图谱
│   │   └── {resource_id}/
│   │       ├── summary.md   # AI 总结
│   │       ├── graph.json   # 知识图谱
│   │       └── questions.md # 自动生成的题目
│   └── review/              # 复习计划
│       └── schedule.json    # 遗忘曲线调度表
```

### 6.3 MEMORY.md 格式

```markdown
# MEMORY.md - 学习画像

> MindFlow 长期记忆文件，记录学生的核心学习状态。
> 每日日志在 memory/，学习总结在 learnings/。

## 学习偏好
- 偏好语言：中文
- 学习风格：偏视觉化
- 学习节奏：中等
- 响应方式：喜欢追问引导，不要直接给答案

## 知识掌握度

### 已掌握
- 线性代数/矩阵乘法 (0.92) - 2026-04-05 掌握
- 微积分/导数基本概念 (0.88) - 2026-04-03 掌握

### 薄弱点
- 线性代数/特征值分解 (0.25) - 概念混淆：特征值与特征向量关系不清
- 微积分/链式法则 (0.40) - 方法错误：复合函数求导顺序错误

### 错误模式
- 常混淆相似概念（如特征值/奇异值）
- 计算步骤容易跳步导致粗心错误

## 学习历史
- 2026-04-09: 学习线性代数/正交矩阵，表现良好
- 2026-04-08: 复习微积分/链式法则，仍有困难

---
*最后更新：2026-04-09*
```

### 6.4 记忆读写机制

| 操作 | 触发方式 | 工具 |
|------|---------|------|
| **搜索** | Agent 需要查询历史时自动调用 | memory_search（混合搜索：向量 + 关键词） |
| **读取** | 每次会话开始自动加载 | memory_get（读 MEMORY.md + 最近 2 天日志） |
| **写入** | 每轮对话后自动 + 用户显式指令 | memory_write（更新掌握度、记录要点） |
| **整理** | 每日定时任务 | dreaming sweep（从短期记忆提炼到长期记忆） |

### 6.5 Dreaming Sweep（参考 OpenClaw）

每日定时任务，自动整理记忆：

```
每日短期记忆（memory/YYYY-MM-DD.md）
      |
  AI 分析：哪些是重要的学习发现？
      |
  评分筛选：
  - 新掌握的概念 -> 更新 MEMORY.md 掌握度
  - 发现的薄弱点 -> 更新 MEMORY.md 薄弱点
  - 错误模式     -> 更新 MEMORY.md 错误模式
  - 临时信息     -> 丢弃
      |
  输出到 learnings/YYYY-MM-DD.md（精华总结）
  更新 MEMORY.md（长期画像）
```

## 七、苏格拉底对话状态机

产品核心差异化，用 Eino Graph 编排实现：

```
          +----------+
          |  开场     |  AI："准备好学X概念了吗？先看看你对Y了解多少"
          +----+-----+
               v
          +----------+
     +--->|  提问     |  AI 提出引导性问题（不给答案）
     |    +----+-----+
     |         v
     |    +----------+
     |    | 等待回答  |  学生输入
     |    +----+-----+
     |         v
     |    +----------+
     |    |  诊断     |  Diagnostic Agent 分析回答
     |    +----+-----+
     |         |
     |    +----+------------+-------------+
     |    v                 v             v
     | +------+      +----------+   +----------+
     | | 正确  |      |概念不清   |   |方法错误   |
     | +--+---+      +----+-----+   +----+-----+
     |    |               |              |
     |    v               v              v
     | 深入追问         补充前置知识     引导换方法
     | 或进入下一概念    再回来重试       提示思路
     |    |               |              |
     +----+---------------+--------------+

  特殊处理：
  - 学生卡住超过 2 轮 -> 给一个小提示（不是答案）
  - 学生卡住超过 4 轮 -> 降低难度，换个角度解释
  - 学生明确要求 -> 切换到直接讲解模式
  - 连续 3 题正确 -> 提高难度或进入下一概念
```

## 八、遗忘曲线系统

基于 SM-2 算法（SuperMemo）改进版：

### 8.1 数据模型

```go
type ReviewItem struct {
    ConceptID       string    // 知识点 ID
    EasinessFactor  float64   // 难度系数（初始 2.5）
    Interval        int       // 当前复习间隔（天）
    Repetitions     int       // 连续正确次数
    NextReview      time.Time // 下次复习时间
    LastReview      time.Time // 上次复习时间
    LastScore       int       // 上次评分 (0-5)
}
```

### 8.2 评分标准

| 分数 | 含义 | 间隔变化 |
|------|------|---------|
| 5 | 完美回忆 | 间隔 * EF |
| 4 | 犹豫但正确 | 间隔 * EF * 0.9 |
| 3 | 困难但正确 | 间隔 * EF * 0.8 |
| 2 | 错误但接近 | 重置为 1 天 |
| 1 | 错误且偏差大 | 重置为 1 天，降低 EF |
| 0 | 完全忘记 | 重置为 1 天，大幅降低 EF |

### 8.3 AI 主动触发

Curriculum Agent 每次对话开始时：
1. 查询到期的复习项
2. 优先安排复习（复习 > 新内容）
3. 生成针对性复习题
4. 根据回答更新 ReviewItem

## 九、技术架构

```
+==================================================+
|              Docker Compose 统一编排               |
+==================================================+
|                                                   |
|  +--------------------------------------------+  |
|  |          Frontend (Next.js)                 |  |
|  |  对话界面 / 知识图谱 / 进度仪表盘 / 复习提醒   |  |
|  +-------------------+------------------------+  |
|                      | WebSocket + REST           |
|  +-------------------v------------------------+  |
|  |          API Gateway (Go + Hertz)           |  |
|  |  路由 / WebSocket 管理 / 中间件              |  |
|  +---------+-----------------+----------------+  |
|            |                 |                    |
|  +---------v---------+  +----v--------------+    |
|  |  Agent Runtime    |  |  Python AI Svc    |    |
|  |  (Go + Eino)      |  |  (FastAPI)        |    |
|  |                   |  |                   |    |
|  | - Orchestrator    |  | - 文档解析         |    |
|  | - Tutor Agent     |  |   (LlamaParse)    |    |
|  | - Diagnostic      |  | - 知识图谱构建     |    |
|  | - Memory Agent    |  |   (NetworkX)      |    |
|  | - Curriculum      |  | - Embedding       |    |
|  | - Quiz Agent      |  |   (OpenAI/Local)  |    |
|  | - Review Agent    |  | - 向量检索         |    |
|  |                   |  |   (Qdrant)        |    |
|  +---------+---------+  +----+--------------+    |
|            |                  |                   |
|  +---------v------------------v--------------+   |
|  |             Data Layer                    |   |
|  |                                           |   |
|  |  PostgreSQL      Qdrant       Redis       |   |
|  |  (用户配置       (向量存储     (会话缓存    |   |
|  |   掌握度         文档嵌入)     遗忘曲线     |   |
|  |   学习记录                     调度队列)    |   |
|  |   复习调度)                                |   |
|  |                                           |   |
|  |  Docker Volumes (持久化)                   |   |
|  |  - mindflow-pg-data   (PostgreSQL 数据)    |   |
|  |  - mindflow-qdrant    (向量数据)           |   |
|  |  - mindflow-redis     (Redis 持久化)       |   |
|  |  - mindflow-memory    (Markdown 记忆文件)  |   |
|  |  - mindflow-uploads   (用户上传资料)       |   |
|  +-------------------------------------------+   |
|                                                   |
+===================================================+
```

### Go <-> Python 通信

```
Go Agent Runtime ---gRPC---> Python AI Service
                                |
                                +-- /parse    (文档解析)
                                +-- /embed    (生成嵌入)
                                +-- /search   (向量检索)
                                +-- /graph    (知识图谱操作)
                                +-- /extract  (知识点提取)
```

## 十、项目结构

```
MindFlow/
├── docs/
│   └── plans/
│       └── 2026-04-09-mindflow-design.md    # 本文档
│
├── backend/                                  # Go 后端
│   ├── cmd/
│   │   └── server/
│   │       └── main.go                       # 入口
│   ├── internal/
│   │   ├── agent/                            # Agent 实现
│   │   │   ├── orchestrator.go               # 主编排器
│   │   │   ├── orchestrator_test.go
│   │   │   ├── tutor.go                      # 苏格拉底教学
│   │   │   ├── tutor_test.go
│   │   │   ├── diagnostic.go                 # 错误诊断
│   │   │   ├── diagnostic_test.go
│   │   │   ├── memory.go                     # 记忆管理
│   │   │   ├── memory_test.go
│   │   │   ├── curriculum.go                 # 学习规划
│   │   │   ├── curriculum_test.go
│   │   │   ├── quiz.go                       # 出题
│   │   │   ├── quiz_test.go
│   │   │   ├── review.go                     # 复习调度
│   │   │   └── review_test.go
│   │   ├── memory/                           # 记忆系统
│   │   │   ├── store.go                      # 存储接口
│   │   │   ├── store_test.go
│   │   │   ├── markdown.go                   # Markdown 文件读写
│   │   │   ├── markdown_test.go
│   │   │   ├── search.go                     # 记忆搜索
│   │   │   ├── search_test.go
│   │   │   ├── dreaming.go                   # Dreaming sweep
│   │   │   └── dreaming_test.go
│   │   ├── review/                           # 遗忘曲线
│   │   │   ├── sm2.go                        # SM-2 算法
│   │   │   ├── sm2_test.go
│   │   │   ├── scheduler.go                  # 复习调度器
│   │   │   └── scheduler_test.go
│   │   ├── handler/                          # HTTP/WS 处理器
│   │   │   ├── chat.go
│   │   │   ├── chat_test.go
│   │   │   ├── resource.go                   # 资料上传
│   │   │   └── resource_test.go
│   │   ├── model/                            # 数据模型
│   │   │   ├── student.go
│   │   │   ├── concept.go
│   │   │   └── review_item.go
│   │   └── service/                          # Python 服务客户端
│   │       ├── content_client.go             # gRPC client
│   │       └── content_client_test.go
│   ├── go.mod
│   └── go.sum
│
├── ai-service/                               # Python AI 微服务
│   ├── app/
│   │   ├── main.py                           # FastAPI 入口
│   │   ├── routers/
│   │   │   ├── parse.py                      # 文档解析
│   │   │   ├── embed.py                      # Embedding
│   │   │   ├── search.py                     # 向量检索
│   │   │   └── graph.py                      # 知识图谱
│   │   ├── services/
│   │   │   ├── parser.py                     # 文档解析服务
│   │   │   ├── embedder.py                   # Embedding 服务
│   │   │   ├── knowledge_graph.py            # 知识图谱服务
│   │   │   └── vector_store.py               # 向量存储
│   │   └── models/
│   │       └── schemas.py                    # 数据模型
│   ├── tests/
│   │   ├── test_parser.py
│   │   ├── test_embedder.py
│   │   ├── test_knowledge_graph.py
│   │   └── test_vector_store.py
│   ├── requirements.txt
│   └── pyproject.toml
│
├── frontend/                                 # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                      # 主页/对话界面
│   │   │   ├── knowledge/page.tsx            # 知识图谱
│   │   │   ├── dashboard/page.tsx            # 学习仪表盘
│   │   │   └── review/page.tsx               # 复习计划
│   │   ├── components/
│   │   │   ├── chat/                         # 对话组件
│   │   │   ├── graph/                        # 知识图谱可视化
│   │   │   ├── dashboard/                    # 仪表盘组件
│   │   │   └── review/                       # 复习组件
│   │   ├── lib/
│   │   │   ├── ws.ts                         # WebSocket 客户端
│   │   │   ├── api.ts                        # REST 客户端
│   │   │   └── types.ts                      # 类型定义
│   │   └── hooks/
│   │       ├── useChat.ts
│   │       └── useReview.ts
│   ├── tests/
│   │   ├── components/                       # 组件单测 (Vitest)
│   │   └── e2e/                              # E2E 测试 (Playwright)
│   ├── package.json
│   └── tsconfig.json
│
├── proto/                                    # gRPC 定义
│   └── content.proto
│
├── docker-compose.yml                        # Docker Compose 编排（一键部署）
├── .env.example                              # 环境变量模板
├── .dockerignore                             # Docker 构建排除
├── backend/Dockerfile                        # Go 后端镜像
├── ai-service/Dockerfile                     # Python AI 微服务镜像
├── frontend/Dockerfile                       # Next.js 前端镜像
├── Makefile                                  # 常用命令
└── README.md
```

## 十一、部署与持久化

### 11.1 一键部署

所有服务通过 `docker-compose up -d` 一键启动，无需手动安装任何环境依赖。

```bash
# 1. 复制环境变量
cp .env.example .env
# 2. 编辑 .env，填入 API Key 等配置
# 3. 启动所有服务
docker-compose up -d
```

### 11.2 服务清单

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| frontend | 自建 | 3000 | Next.js 前端 |
| backend | 自建 | 8080 | Go + Hertz + Eino |
| ai-service | 自建 | 8000 | Python + FastAPI |
| postgres | postgres:16 | 5432 | 结构化数据 |
| qdrant | qdrant/qdrant | 6333/6334 | 向量存储 |
| redis | redis:7 | 6379 | 缓存/调度队列 |

### 11.3 持久化策略

| 数据 | 存储位置 | 持久化方式 |
|------|---------|----------|
| 用户/学生信息、配置 | PostgreSQL | Docker volume `mindflow-pg-data` |
| 掌握度、学习记录 | PostgreSQL | Docker volume `mindflow-pg-data` |
| 复习调度项 (ReviewItem) | PostgreSQL | Docker volume `mindflow-pg-data` |
| 知识点/概念关系 | PostgreSQL | Docker volume `mindflow-pg-data` |
| 文档向量嵌入 | Qdrant | Docker volume `mindflow-qdrant` |
| 会话上下文/调度队列 | Redis | Docker volume `mindflow-redis` |
| 记忆文件（画像/日志/学习总结） | Markdown 文件 | Docker volume `mindflow-memory` |
| 用户上传资料 | 文件系统 | Docker volume `mindflow-uploads` |

> **原则**：结构化数据（配置、掌握度、学习记录、复习调度）全部存 PostgreSQL；记忆文件保留 Markdown 格式（人类可读）；所有有状态的存储都通过 Docker named volume 持久化，容器重启不丢数据。

### 11.4 开发模式

开发时三个应用服务通过 volume 挂载源码目录，支持代码热重载：
- **Go 后端**：使用 `air` 热重载
- **Python AI 微服务**：使用 `uvicorn --reload`
- **Next.js 前端**：自带 HMR 热更新

## 十二、测试策略（TDD）

### 12.1 开发流程

```
1. 写失败的测试（Red）
2. 写最小实现使测试通过（Green）
3. 重构（Refactor）
4. 重复
```

### 12.2 测试分层

| 层级 | 工具 | 覆盖 | 运行频率 |
|------|------|------|---------|
| **Go 单元测试** | testing + testify | Agent 逻辑、SM-2 算法、记忆系统 | 每次提交 |
| **Go 集成测试** | testcontainers | Agent 编排、数据库交互 | 每次 PR |
| **Python 单测** | pytest | 文档解析、知识图谱、Embedding | 每次提交 |
| **前端组件测试** | Vitest + Testing Library | 组件渲染、交互逻辑 | 每次提交 |
| **E2E 测试** | Playwright | 核心用户旅程 | 每次 PR |
| **LLM 评估** | 自定义 eval | 苏格拉底对话质量、诊断准确率 | 每周 |

### 12.3 关键测试场景

**SM-2 算法测试**：
```go
func TestSM2_PerfectRecall(t *testing.T) {
    item := NewReviewItem("concept_1")
    item = item.Review(5) // 完美回忆
    assert.Equal(t, 1, item.Interval)    // 第一次: 1天
    item = item.Review(5)
    assert.Equal(t, 6, item.Interval)    // 第二次: 6天
    item = item.Review(5)
    assert.Greater(t, item.Interval, 6)  // 第三次: >6天
}

func TestSM2_ForgottenReset(t *testing.T) {
    item := NewReviewItem("concept_1")
    item.Interval = 30
    item.Repetitions = 5
    item = item.Review(1) // 错误且偏差大
    assert.Equal(t, 1, item.Interval)    // 重置为 1 天
    assert.Equal(t, 0, item.Repetitions) // 重置连续正确次数
}
```

**苏格拉底对话测试**：
```go
func TestTutor_NeverGivesDirectAnswer(t *testing.T) {
    tutor := NewTutorAgent(mockLLM)
    response := tutor.Respond(context.Background(), "x^2 - 5x + 6 = 0 怎么解？")
    assert.NotContains(t, response, "x=2")
    assert.NotContains(t, response, "x=3")
    // 应该是引导性提问
    assert.True(t, isQuestion(response) || isGuidingHint(response))
}
```

**记忆系统测试**：
```go
func TestMemory_WriteAndSearch(t *testing.T) {
    mem := NewMemoryStore(tmpDir)
    mem.Write("2026-04-09", "学生在特征值分解上概念混淆")
    results := mem.Search("特征值")
    assert.Len(t, results, 1)
    assert.Contains(t, results[0].Content, "概念混淆")
}

func TestMemory_DreamingSweep(t *testing.T) {
    mem := NewMemoryStore(tmpDir)
    mem.Write("2026-04-09", "掌握了矩阵乘法，特征值还不行")
    sweep := NewDreamingSweep(mem, mockLLM)
    sweep.Run()
    profile := mem.GetLongTermMemory()
    assert.Contains(t, profile.Mastered, "矩阵乘法")
    assert.Contains(t, profile.Weak, "特征值")
}
```

## 十三、前端核心页面

| 页面 | 功能 | 优先级 |
|------|------|--------|
| **学习对话** | 主界面：苏格拉底对话 + 侧边栏实时知识图谱高亮当前节点 | P0 |
| **资料库** | 上传/管理资料，查看 AI 提取的知识点和总结 | P1 |
| **知识图谱** | 全屏可视化所有知识点及关系，颜色标注掌握度（绿/黄/红） | P2 |
| **学习仪表盘** | 整体进度、薄弱点排行、学习时长/频率统计 | P2 |
| **复习计划** | 遗忘曲线日历视图，今日待复习列表，一键开始复习 | P3 |

## 十四、分阶段实施计划

### P0：跑通核心教学循环（2-3 周）

**目标**：一个能苏格拉底式对话的 AI 导师

- [ ] Go 项目脚手架 + Eino 集成
- [ ] Orchestrator + Tutor Agent（TDD）
- [ ] Hertz WebSocket 服务
- [ ] Next.js 对话界面
- [ ] E2E：用户发消息 -> AI 引导式回复

### P1：资料理解（2 周）

**目标**：上传 PDF，AI 理解并基于内容教学

- [ ] Python AI 服务：文档解析 + Embedding
- [ ] Go gRPC 客户端
- [ ] Content Agent 集成到 Orchestrator
- [ ] 前端资料上传页面
- [ ] E2E：上传 PDF -> AI 基于内容提问

### P2：诊断和记忆（2 周）

**目标**：AI 能诊断错误、记住学生状态

- [ ] Diagnostic Agent（TDD）
- [ ] Memory Agent + Markdown 记忆文件系统（TDD）
- [ ] memory_search / memory_get / memory_write 工具
- [ ] Dreaming sweep 定时任务
- [ ] 知识图谱可视化（前端）
- [ ] E2E：跨 session 记忆连续性

### P3：出题和复习（2 周）

**目标**：自动出题 + 遗忘曲线复习

- [ ] SM-2 算法实现（TDD）
- [ ] Quiz Agent + Review Agent
- [ ] Curriculum Agent（AI 主动驱动）
- [ ] 复习计划日历（前端）
- [ ] 学习仪表盘（前端）
- [ ] E2E：遗忘曲线提醒 -> 复习 -> 更新掌握度

### P4：打磨和优化（持续）

- [ ] 用户系统（注册登录）
- [ ] 多用户数据隔离
- [ ] LLM 评估体系（对话质量、诊断准确率）
- [ ] 性能优化
- [ ] 移动端适配
