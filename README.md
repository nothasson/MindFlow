# MindFlow

面向真实学习闭环的 AI 学习系统：解析资料、诊断掌握度、规划下一步、安排复习，并在多次会话中持续记忆你的学习状态。

## 核心能力

- **苏格拉底式对话教学** — AI 不直接给答案，通过提问引导学生自己推导
- **智能诊断** — 分析学生回答，判断错误类型（概念错/方法错/粗心），针对性补强
- **知识图谱** — 上传学习资料，AI 自动解析并构建知识点关系图
- **遗忘曲线复习** — 基于 SM-2 算法自动安排复习，AI 主动决定今天学什么
- **三层记忆系统** — 跨 session 记住学生的一切学习状态

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TypeScript, Next.js, Tailwind CSS |
| 后端 | Go 1.26, Eino（Agent 编排）, Hertz（HTTP/WS） |
| AI 微服务 | Python 3.11, FastAPI, LlamaParse, NetworkX |
| LLM | 硅基流动 SiliconFlow + MiniMax-M2.5 |
| 数据库 | PostgreSQL 16, Qdrant（向量）, Redis 7 |
| 部署 | Docker + Docker Compose 一键部署 |

## 快速开始

### 前置条件

- [Docker](https://www.docker.com/) 和 Docker Compose
- 硅基流动 API Key（[获取地址](https://siliconflow.cn/)）

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/nothasson/MindFlow.git
cd MindFlow

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 LLM_API_KEY

# 3. 启动所有服务（部署模式，不挂载本地源码）
docker-compose -f docker-compose.yml up -d

# 4. 访问
# 前端：http://localhost:3000
# 后端 API：http://localhost:8080
# AI 微服务：http://localhost:8000
```

### 本地开发

```bash
# 直接 docker-compose up 会自动加载 docker-compose.override.yml，
# 挂载源码到容器内，改代码无需重建镜像
docker-compose up -d
```

### 常用命令

```bash
docker-compose up -d               # 本地开发（自动加载 override）
docker-compose -f docker-compose.yml up -d  # 部署模式（不加载 override）
docker-compose down                # 停止所有服务
docker-compose up -d --build       # 依赖变化时重新构建
docker-compose logs -f backend     # 查看指定服务日志
docker-compose restart backend     # 重启指定服务
```

## 项目结构

```
MindFlow/
├── backend/          # Go 后端（Hertz + Eino 多 Agent 系统）
├── ai-service/       # Python AI 微服务（FastAPI）
├── frontend/         # Next.js 前端
├── proto/            # gRPC 服务定义
├── docs/plans/       # 设计文档
├── docker-compose.yml
└── .env.example
```

## 架构

```
前端 (Next.js) ──WebSocket/REST──> Go 后端 (Hertz + Eino) ──gRPC──> Python AI 微服务 (FastAPI)
                                         │                                │
                                         └── PostgreSQL / Redis ──────────┘── Qdrant
```

**多 Agent 系统**（Go + Eino 编排）：
- Orchestrator — 总调度
- Tutor Agent — 苏格拉底式教学
- Diagnostic Agent — 错误诊断
- Memory Agent — 学习画像维护
- Curriculum Agent — 学习规划
- Quiz Agent — 自动出题
- Review Agent — 遗忘曲线调度

## 更新历史

| 日期 | 类型 | 说明 |
|------|------|------|
| 2026-04-09 | feat | 实现 SSE 流式输出 + 前端打字机效果，AI 回复逐字追加渲染 |
| 2026-04-09 | feat | 对齐 claude.ai 三态界面，并让 AI 回复支持 Markdown 与 Mermaid 图码切换渲染 |
| 2026-04-09 | feat | 首页重构为“任务导向工作台”（双栏 + 轻量概览），文案改为功能直述并统一冷色蓝灰视觉 |
| 2026-04-09 | feat | 完成 P0 最小对话链路：TutorAgent + POST /api/chat + 前端对话界面 |
| 2026-04-09 | fix | 升级 Go 到 1.26，修复 Docker 构建与 Qdrant 健康检查 |
| 2026-04-09 | chore | 默认 LLM 模型切换为硅基流动 SiliconFlow + MiniMax-M2.5 |
| 2026-04-09 | feat | 项目初始化，搭建 Docker 全容器化开发环境 |
| 2026-04-09 | feat | 创建三服务最小骨架（Go 后端 / Python AI 微服务 / Next.js 前端） |
