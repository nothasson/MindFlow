# MindFlow

AI 原生自适应学习平台。不是问答机，是一个有记忆、会主动驱动学习节奏的私人导师。

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
| LLM | 硅基流动 SiliconFlow + DeepSeek-V3.2 |
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

# 3. 启动所有服务
docker-compose up -d

# 4. 访问
# 前端：http://localhost:3000
# 后端 API：http://localhost:8080
# AI 微服务：http://localhost:8000
```

### 常用命令

```bash
docker-compose up -d               # 启动所有服务
docker-compose down                # 停止所有服务
docker-compose up -d --build       # 重新构建并启动
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
| 2026-04-09 | feat | 项目初始化，搭建 Docker 全容器化开发环境 |
| 2026-04-09 | feat | 创建三服务最小骨架（Go 后端 / Python AI 微服务 / Next.js 前端） |
| 2026-04-09 | chore | 配置硅基流动 SiliconFlow + DeepSeek-V3.2 作为默认 LLM |
