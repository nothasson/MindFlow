# CODEBUDDY.md

本文件为 CodeBuddy Code 在此仓库中工作时提供指引。

## 项目概述

MindFlow 是一个 AI 原生的自适应学习平台。学生上传学习资料，AI 自动解析内容、构建知识图谱、规划学习路径、通过苏格拉底式对话教学、诊断薄弱点，并基于遗忘曲线安排复习。它**不是**问答机器人，而是一个有记忆、会主动驱动学习节奏的私人导师。

设计文档：`docs/plans/2026-04-09-mindflow-design.md`

## 架构

三服务架构，共享数据层：

```
前端 (Next.js)  ──WebSocket/REST──>  Go 后端 (Hertz + Eino Agents)  ──gRPC──>  Python AI 微服务 (FastAPI)
                                                  │                                      │
                                                  └──── PostgreSQL / Redis / 文件系统 ────┘── Qdrant (向量)
```

### Go 后端 (`backend/`)

核心 Agent 运行时，基于 **Eino**（Agent 编排框架）和 **Hertz**（HTTP/WebSocket）。

- **多 Agent 系统** — Orchestrator 调度各专职 Agent：
  - `Tutor Agent` — 苏格拉底式对话（绝不直接给答案）
  - `Diagnostic Agent` — 分析学生回答，分类错误类型（概念错/方法错/粗心）
  - `Memory Agent` — 维护学生画像（掌握度、薄弱点、学习偏好）
  - `Curriculum Agent` — 决定每次会话学什么、复习什么
  - `Quiz Agent` — 自动出题和批改
  - `Review Agent` — SM-2 间隔重复调度
- `internal/memory/` — 三层记忆系统（即时/短期/长期），使用 Redis、Markdown 文件和 PostgreSQL
- `internal/review/` — SM-2 算法实现和复习调度器
- `internal/handler/` — HTTP/WebSocket 处理器
- `internal/service/` — Python AI 服务的 gRPC 客户端

### Python AI 微服务 (`ai-service/`)

通过 **FastAPI** 处理 AI/ML 工作负载：

- `/parse` — 文档解析（LlamaParse）
- `/embed` — 生成 Embedding
- `/search` — 向量相似度检索（Qdrant）
- `/graph` — 知识图谱操作（NetworkX）
- `/extract` — 知识点提取

### 前端 (`frontend/`)

**Next.js + Tailwind CSS**，四个主要页面：

- `/` — 苏格拉底式对话界面（P0）
- `/knowledge` — 知识图谱可视化，颜色标注掌握度（绿/黄/红）
- `/dashboard` — 学习进度和数据分析仪表盘
- `/review` — 遗忘曲线日历视图和复习队列

### Proto (`proto/`)

Go ↔ Python 通信的 gRPC 服务定义（`content.proto`）。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TypeScript, Next.js, Tailwind CSS |
| 后端 | Go, Eino（Agent 编排）, Hertz（HTTP/WS） |
| AI 微服务 | Python, FastAPI, LlamaParse, NetworkX |
| 数据库 | PostgreSQL, Qdrant（向量）, Redis（缓存/调度） |
| 通信 | gRPC（Go ↔ Python）, WebSocket（前端 ↔ 后端） |

## 常用命令

通过项目根目录的 `Makefile` 管理常用命令。

### Go 后端

```bash
cd backend
go test ./...                           # 运行全部测试
go test ./internal/agent/ -run TestSM2  # 运行指定测试
go test -v ./internal/review/...        # 详细输出某个包的测试结果
go run cmd/server/main.go               # 启动服务
```

### Python AI 微服务

```bash
cd ai-service
pip install -r requirements.txt    # 安装依赖
pytest                             # 运行全部测试
pytest tests/test_parser.py        # 运行指定测试文件
pytest -k "test_name"              # 按名称运行指定测试
uvicorn app.main:app --reload      # 启动开发服务器
```

### 前端

```bash
cd frontend
npm install                        # 安装依赖
npm run dev                        # 启动开发服务器
npx vitest                         # 运行单元测试
npx vitest run tests/components/   # 运行指定测试目录
npx playwright test                # 运行 E2E 测试
npx playwright test --ui           # 带 UI 的 E2E 测试
```

### Docker 全服务

```bash
cp .env.example .env               # 首次部署：复制环境变量模板
docker-compose up -d               # 启动所有服务（首次会自动构建镜像）
docker-compose down                # 停止所有服务
docker-compose up -d --build       # 重新构建镜像并启动
docker-compose logs -f backend     # 查看指定服务日志
docker-compose restart backend     # 重启指定服务
```

## 开发原则

- **TDD 驱动开发** — 先写失败的测试（Red），再写最小实现使其通过（Green），然后重构（Refactor）。所有核心逻辑（Agent、SM-2 算法、记忆系统）必须先有测试再实现。
- **苏格拉底原则** — Tutor Agent 绝不直接给答案，所有教学回复必须是引导性提问或提示。测试必须验证这一不变性。
- **记忆连续性** — 记忆系统必须维持跨 session 的状态。Dreaming Sweep 每日定时任务负责将短期记忆提炼为长期学习画像。
- **AI Native，不是 Workflow** — 严禁用 `if/switch + 关键词匹配` 做 Agent 路由或决策。所有需要理解语义的判断（路由分发、意图识别、内容分类等）必须交给 LLM 决策。关键词匹配只能用于纯机械性操作（如命令解析），不能用于替代语义理解。这是 AI Native 产品和 workflow 工具的本质区别。

## 规则

### 1. 完成功能点后必须提交并推送

每完成一个小功能点（一个函数、一个组件、一个接口、一个测试用例等），必须立即：
1. `git add` 相关文件
2. `git commit` — 使用**中文**规范化 commit 信息，格式如下：
   ```
   <类型>: <简要描述>

   <详细说明（可选）>
   ```
   类型包括：`feat`(新功能)、`fix`(修复)、`test`(测试)、`refactor`(重构)、`docs`(文档)、`style`(样式)、`chore`(杂项)
3. `git push origin main`

示例：
```
feat: 实现 SM-2 遗忘曲线算法核心逻辑
test: 添加 Tutor Agent 苏格拉底式对话单元测试
fix: 修复记忆系统跨 session 状态丢失问题
```

### 2. 修改文件后重启对应服务

本地开发时，`docker-compose.override.yml` 会自动将源码目录挂载到容器内，大多数改动通过 HMR / 热重载即时生效，无需重建镜像。

**需要重建镜像（`docker-compose up -d --build <服务名>`）的情况：**
- 新增或删除 npm/pip/go 依赖（`package.json`、`requirements.txt`、`go.mod` 变化）
- 修改 `Dockerfile` 本身
- 修改 `docker-compose.yml` 或 `docker-compose.override.yml`

**日常代码改动（新增/修改/删除源码文件）** 只需等 HMR 自动刷新，或执行 `docker-compose restart <服务名>`。

| 修改范围 | 操作 |
|---------|------|
| 源码文件（`.ts/.tsx/.go/.py`） | 无需操作，HMR 自动生效；异常时 `docker-compose restart <服务名>` |
| `package.json` / `requirements.txt` / `go.mod` 依赖变化 | `docker-compose up -d --build <服务名>` |
| `Dockerfile` / `docker-compose.yml` | `docker-compose down && docker-compose up -d --build` |
| `proto/` 下 `.proto` 文件 | 先 `make proto`，再 `docker-compose restart backend ai-service` |

**部署模式**（别人 clone 后部署）使用：
```bash
docker-compose -f docker-compose.yml up -d
```
此时不加载 override，完全走 Dockerfile 构建镜像，不依赖本地源码挂载。

### 3. 全链路检查，不做打补丁式修改

新增或修改逻辑时，必须顺着整条调用链路检查，确保一致性：

- **数据模型变更**：检查 Go model → PostgreSQL schema → Python schemas → 前端 types.ts 是否同步
- **API 接口变更**：检查 proto 定义 → Go handler → Python router → 前端 api.ts/ws.ts 是否一致
- **Agent 行为变更**：检查 Agent 实现 → Orchestrator 调度 → 记忆系统读写 → 前端展示是否衔接
- **配置变更**：检查 .env.example → docker-compose.yml → 各服务读取环境变量的代码是否对齐

禁止"先改一处跑通再说"的打补丁方式。每次修改必须把相关链路上的所有文件一起改完、一起提交。

### 4. 前端不展示虚假数据

前端界面中出现的所有数据（会话列表、学习状态、任务卡片等）必须来自真实数据源或明确标注为占位空态。

- **禁止硬编码假会话、假用户名、假统计数据**用于正式界面
- 没有真实数据时，展示空态（如"暂无会话"）或引导态（如"开始你的第一次对话"），而不是编造数据
- 仅在测试文件中允许使用 mock 数据
- 用户头像、用户名等个人信息，在没有登录系统前不展示或使用通用占位符

### 5. 重要版本变更记录到 README 更新历史

以下类型的变更必须同步更新 `README.md` 的"更新历史"章节：

- 新增功能模块（如新增 Agent、新增页面）
- 技术栈或依赖版本的重大变更
- 架构调整（如新增服务、修改通信方式）
- 部署方式变更

格式：
```markdown
## 更新历史

| 日期 | 类型 | 说明 |
|------|------|------|
| 2026-04-09 | feat | 项目初始化，搭建 Docker 全容器化开发环境 |
```

### 6. 代码提交前必须 Review

每轮代码修改完成后，必须运行 `/review`（隔离上下文子 agent）做代码审查。流程：

1. 写完代码 + 跑通测试
2. 运行 `/review`，等待 review 结果
3. **严重** 问题必须立即修复，修复后再次 `/review` 直到通过
4. **警告** 问题视情况修复或记录到 plan 的"已知待优化"列表中
5. **建议** 类问题记录到 plan，后续统一优化
6. Review 通过后再 `git commit && git push`

### 7. 已知技术债务记录到 plan

Review 中发现的非紧急问题，不在当前功能中修复，但必须记录到 `docs/plans/2026-04-09-master-progress.md` 的"已知待优化"章节，避免遗忘。

## 关键设计决策

- **SM-2（SuperMemo）算法**用于间隔重复 — `internal/review/sm2.go`。评分 0-5 分；≤2 分重置复习间隔为 1 天。
- **基于 Markdown 的记忆文件**存放于 `~/.mindflow/workspace/` — 人类可读、对 git 友好。`MEMORY.md` 存储长期画像；`memory/YYYY-MM-DD.md` 存储每日学习日志。
- **Eino Graph 实现苏格拉底对话状态机** — 状态流转：开场 → 提问 → 等待回答 → 诊断 →（正确/概念不清/方法错误）→ 循环。特殊处理：卡住 2 轮以上 → 给提示；4 轮以上 → 降低难度；连续 3 题正确 → 提升难度或进入下一概念。
