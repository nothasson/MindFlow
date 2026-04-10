# MindFlow

面向真实学习闭环的 AI 学习系统：解析资料、诊断掌握度、规划下一步、安排复习，并在多次会话中持续记忆你的学习状态。

## 产品定位

MindFlow 不是问答机器人，而是一个有记忆、会主动驱动学习节奏的 **AI 私人导师**。

核心理念：
- **AI 不给答案** — 苏格拉底式引导，让学生自己推导
- **AI 记住一切** — 跨会话记忆学生的掌握度、薄弱点和学习偏好
- **AI 主动驱动** — 基于遗忘曲线自动安排复习，AI 决定今天学什么

## 核心能力

| 能力 | 说明 |
|------|------|
| 苏格拉底式对话 | AI 通过提问引导学生思考，绝不直接给答案 |
| 智能诊断 | 分析回答，判断错误类型（概念错/方法错/粗心） |
| 资料理解 | 上传 PDF/文本/URL，AI 自动解析并基于内容教学 |
| 知识图谱 | 自动提取知识点并构建关系图，颜色标注掌握度 |
| 遗忘曲线复习 | SM-2 算法自动安排间隔重复复习 |
| 三层记忆系统 | 即时/短期/长期记忆，跨会话连续 |
| 个性化教学 | 3 种教学风格 × 3 档掌握度，自动适配 |
| 章节化课程 | 资料自动转化为结构化课程，按章节学习 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Compose 统一编排                       │
│                                                                   │
│  ┌──────────────┐     ┌──────────────────────┐     ┌───────────┐ │
│  │   Frontend    │     │    Go Backend         │     │  Python   │ │
│  │  (Next.js)    │────▶│  (Hertz + Eino)       │────▶│ AI Service│ │
│  │              │ SSE │                        │HTTP │ (FastAPI) │ │
│  │  - 对话界面   │     │  8 Agent 系统          │     │ - PDF解析 │ │
│  │  - 资料库    │     │  - Orchestrator        │     │ - Embedding│ │
│  │  - 知识图谱   │     │  - Tutor (苏格拉底)    │     │ - 向量搜索│ │
│  │  - 记忆页    │     │  - Diagnostic (诊断)   │     │ - 知识提取│ │
│  │  - 仪表盘    │     │  - Memory (记忆)       │     └─────┬─────┘ │
│  │  - 复习日历   │     │  - Quiz (出题)         │           │       │
│  │  - 课程详情   │     │  - Review (复习)       │           │       │
│  └──────────────┘     │  - Curriculum (规划)   │           │       │
│                        │  - Content (RAG)       │           │       │
│                        │  - Courseware (课程)    │           │       │
│                        └──────────┬─────────────┘           │       │
│                                   │                         │       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │       │
│  │ PostgreSQL 16 │  │   Redis 7    │  │   Qdrant     │◀─────┘       │
│  │ - 会话/消息   │  │ - 缓存/调度  │  │ - 向量存储    │              │
│  │ - 知识图谱    │  │              │  │              │              │
│  │ - 课程/测验   │  │              │  │              │              │
│  │ - 资料记录    │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  Docker Volumes: pg-data / redis / qdrant / memory / uploads        │
└─────────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TypeScript, Next.js 16, React 19, Tailwind CSS 4 |
| 后端 | Go 1.26, Eino（Agent 编排）, Hertz（HTTP/SSE） |
| AI 微服务 | Python 3.11, FastAPI, PyMuPDF, Qdrant Client |
| LLM | 硅基流动 SiliconFlow（GLM-5.1 / 可切换） |
| 数据库 | PostgreSQL 16, Qdrant（向量）, Redis 7 |
| 测试 | Go testing, Vitest, Playwright MCP |
| 部署 | Docker + Docker Compose（生产/开发分离） |

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
docker-compose -f docker-compose.yml up -d

# 4. 访问
# 前端：http://localhost:3000
# 后端 API：http://localhost:8080
# AI 微服务：http://localhost:8000
```

### 本地开发

```bash
# docker-compose up 自动加载 override，挂载源码到容器，HMR 即时生效
docker-compose up -d
```

### 常用命令

```bash
docker-compose up -d                               # 本地开发
docker-compose -f docker-compose.yml up -d          # 部署模式
docker-compose down                                 # 停止所有服务
docker-compose up -d --build <服务名>                # 依赖变化时重建
docker-compose logs -f backend                       # 查看日志
docker-compose restart backend                       # 重启服务
```

## 项目结构

```
MindFlow/
├── backend/                          # Go 后端
│   ├── cmd/server/main.go            # 入口
│   ├── internal/
│   │   ├── agent/                    # 9 个 Agent（Orchestrator/Tutor/Diagnostic/...）
│   │   ├── config/                   # 配置模块
│   │   ├── handler/                  # HTTP 处理器（chat/conversation/resource/course/...）
│   │   ├── llm/                      # LLM 客户端
│   │   ├── memory/                   # 三层记忆系统 + Dreaming Sweep
│   │   ├── model/                    # 数据模型
│   │   ├── repository/               # 数据库访问层
│   │   ├── review/                   # SM-2 遗忘曲线算法
│   │   └── service/                  # AI 微服务客户端
│   └── migrations/                   # 数据库迁移（6 个）
├── ai-service/                       # Python AI 微服务
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口
│   │   ├── routers/                  # 路由（parse/embed/search/extract/upsert/url）
│   │   ├── models/                   # Pydantic schemas
│   │   └── services/                 # 业务逻辑
│   └── tests/
├── frontend/                         # Next.js 前端
│   └── src/
│       ├── app/                      # 7 个页面路由
│       │   ├── page.tsx              # 主对话
│       │   ├── resources/            # 资料库
│       │   ├── knowledge/            # 知识图谱
│       │   ├── memory/               # 学习记忆
│       │   ├── dashboard/            # 仪表盘
│       │   ├── review/               # 复习日历
│       │   └── courses/[id]/         # 课程详情
│       ├── components/               # 组件
│       │   ├── chat/                 # 对话组件（Markdown/Mermaid 渲染）
│       │   └── layout/              # 布局（AppShell/Sidebar/侧栏收起态）
│       ├── hooks/                    # useChat / useConversations
│       └── lib/                      # API 客户端 / 类型 / Markdown 解析器
├── docs/plans/                       # 设计文档
├── docker-compose.yml                # 生产配置
├── docker-compose.override.yml       # 开发配置（源码挂载）
└── .env.example                      # 环境变量模板
```

## 多 Agent 系统

| Agent | 职责 |
|-------|------|
| **Orchestrator** | 总调度器，AI 语义路由分发到各 Agent |
| **Tutor** | 苏格拉底式引导教学（3 种风格 × 3 档难度） |
| **Diagnostic** | 分析学生回答，分类错误类型 |
| **Memory** | 维护学生画像，分层记忆管理 |
| **Content** | 资料检索上下文注入（RAG） |
| **Courseware** | 资料自动转化为章节化课程 |
| **Quiz** | 基于掌握度自动出题 |
| **Review** | SM-2 遗忘曲线调度复习 |
| **Curriculum** | AI 主动规划学习内容 |

## 前端页面

| 路由 | 功能 |
|------|------|
| `/` | 主对话界面（claude.ai 风格，SSE 流式 + Markdown 渲染） |
| `/resources` | 资料库（PDF/TXT/URL 上传，AI 解析与知识提取） |
| `/knowledge` | 知识图谱可视化（掌握度颜色标注） |
| `/memory` | 学习记忆（画像/时间线/搜索） |
| `/dashboard` | 学习仪表盘（真实数据统计） |
| `/review` | 复习日历（遗忘曲线调度） |
| `/courses/[id]` | 课程详情（章节导航 + 学习目标 + 思考问题） |

## 数据库表

| 表 | 用途 |
|------|------|
| conversations | 会话元信息 |
| messages | 消息记录 |
| resources | 学习资料 |
| knowledge_mastery | 知识点掌握度（SM-2 参数） |
| knowledge_relations | 知识点关系图 |
| courses | 课程 |
| course_sections | 课程章节 |
| course_progress | 课程学习进度 |
| quiz_attempts | 测验记录 |
| wrong_book | 错题本 |

## 设计亮点

### 苏格拉底式教学
AI 绝不直接给出答案。通过追问、提示和引导，帮助学生自己建立推理路径。支持 3 种教学风格（苏格拉底追问/课堂讲解/生活化比喻）和 3 档掌握度（初学/进阶/专家）。

### 增量安全渲染
流式输出时，已完成的 Markdown 块正常渲染，未完成的尾部用纯文本 + 闪烁光标。避免传统打字机模式下 Markdown 重渲染导致的闪烁。

### 三层记忆系统
借鉴 [MemPalace](https://github.com/milla-jovovich/mempalace) 的分层设计：
- **L0 身份层**（~50 tokens，始终加载）
- **L1 掌握度层**（~150 tokens，始终加载）
- **L2 科目上下文**（按需加载）
- **L3 历史深度搜索**（按需，走向量检索）

### Dreaming Sweep
每日凌晨 3 点自动执行，将短期记忆（每日日志）提炼为长期学习画像。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | 硅基流动 API Key | （必填） |
| `LLM_BASE_URL` | LLM API 地址 | `https://api.siliconflow.cn/v1` |
| `LLM_MODEL` | 模型名 | `Pro/zai-org/GLM-5.1` |
| `CORS_ORIGINS` | 允许的跨域来源 | `http://localhost:3000` |
| `FRONTEND_PORT` | 前端端口 | `3000` |
| `BACKEND_PORT` | 后端端口 | `8080` |
| `AI_SERVICE_PORT` | AI 微服务端口 | `8000` |

## 更新历史

| 日期 | 类型 | 说明 |
|------|------|------|
| 2026-04-10 | fix | 修复 PDF 上传 body size 限制，AI 服务补齐中文字体 |
| 2026-04-10 | fix | 修复 13 项技术债务（原子写入/并发锁/超时/CORS/搜索截取） |
| 2026-04-10 | feat | 记忆页（/memory）+ 课程系统 + 侧栏导航补全 |
| 2026-04-10 | feat | P5 Phase 3-5：个性化教学风格、仪表盘真实数据、测验系统 |
| 2026-04-10 | feat | P5 Phase 0：资料持久化、向量入库、知识点提取 |
| 2026-04-09 | feat | P3 出题和复习：Quiz/Review/Curriculum Agent |
| 2026-04-09 | feat | P2 诊断和记忆：Diagnostic + Memory Agent + SM-2 |
| 2026-04-09 | feat | P1 资料理解：PDF 解析/Embedding/向量搜索 |
| 2026-04-09 | feat | SSE 流式输出 + 打字机效果 + 增量安全渲染 |
| 2026-04-09 | feat | 会话持久化 + claude.ai 风格界面 |
| 2026-04-09 | feat | 项目初始化 + Docker 全容器化 |

## License

MIT
