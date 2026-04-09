# Docker 基础设施 + 项目脚手架 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 搭建完整的 Docker 化开发环境，让任何人 `docker-compose up -d` 一键启动所有服务，并为三个应用服务创建最小可运行的项目骨架。

**架构：** Docker Compose 编排 6 个服务（frontend/backend/ai-service/postgres/qdrant/redis），通过 named volume 持久化所有有状态数据。三个应用服务在开发模式下通过 volume 挂载源码，支持热重载。

**技术栈：** Docker, Docker Compose, Go 1.22+, Python 3.11+, Node.js 20+, PostgreSQL 16, Qdrant, Redis 7

---

### Task 1: 创建 .env.example 环境变量模板

**文件:**
- 创建: `.env.example`

**Step 1: 创建环境变量文件**

```env
# MindFlow 环境变量配置
# 使用方法：cp .env.example .env 然后填入实际值

# ===== LLM 配置 =====
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o

# ===== PostgreSQL =====
POSTGRES_USER=mindflow
POSTGRES_PASSWORD=mindflow_dev
POSTGRES_DB=mindflow
POSTGRES_PORT=5432

# ===== Redis =====
REDIS_PORT=6379

# ===== Qdrant =====
QDRANT_HTTP_PORT=6333
QDRANT_GRPC_PORT=6334

# ===== 应用服务端口 =====
BACKEND_PORT=8080
AI_SERVICE_PORT=8000
FRONTEND_PORT=3000
```

**Step 2: 提交**

```bash
git add .env.example
git commit -m "chore: 添加环境变量模板"
git push origin main
```

---

### Task 2: 创建 .dockerignore

**文件:**
- 创建: `.dockerignore`

**Step 1: 创建文件**

```dockerignore
# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# 环境变量
.env

# Node
frontend/node_modules
frontend/.next

# Go
backend/tmp

# Python
ai-service/__pycache__
ai-service/.venv
ai-service/*.pyc

# Docker
docker-compose.yml
docker-compose.override.yml

# Docs
docs/
*.md
!README.md
```

**Step 2: 提交**

```bash
git add .dockerignore
git commit -m "chore: 添加 .dockerignore"
git push origin main
```

---

### Task 3: 创建 .gitignore

**文件:**
- 创建: `.gitignore`

**Step 1: 创建文件**

```gitignore
# 环境变量（含密钥）
.env

# Node
node_modules/
.next/
frontend/node_modules/
frontend/.next/

# Go
backend/tmp/

# Python
__pycache__/
*.pyc
.venv/
ai-service/.venv/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

**Step 2: 提交**

```bash
git add .gitignore
git commit -m "chore: 添加 .gitignore"
git push origin main
```

---

### Task 4: Go 后端最小骨架

**文件:**
- 创建: `backend/go.mod`
- 创建: `backend/cmd/server/main.go`

**Step 1: 初始化 Go module**

```bash
cd backend
go mod init github.com/nothasson/MindFlow/backend
```

**Step 2: 创建 main.go**

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"mindflow-backend"}`))
	})

	log.Printf("MindFlow Backend 启动在 :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		fmt.Fprintf(os.Stderr, "服务启动失败: %v\n", err)
		os.Exit(1)
	}
}
```

**Step 3: 验证编译通过**

```bash
cd backend && go build ./cmd/server/
```

预期：无报错，生成 `server` 二进制文件。

**Step 4: 提交**

```bash
git add backend/
git commit -m "feat: 创建 Go 后端最小骨架（health check 接口）"
git push origin main
```

---

### Task 5: Python AI 微服务最小骨架

**文件:**
- 创建: `ai-service/requirements.txt`
- 创建: `ai-service/app/__init__.py`
- 创建: `ai-service/app/main.py`

**Step 1: 创建 requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
```

**Step 2: 创建 app/__init__.py**

空文件。

**Step 3: 创建 app/main.py**

```python
import os

from fastapi import FastAPI

app = FastAPI(title="MindFlow AI Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "mindflow-ai-service"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
```

**Step 4: 提交**

```bash
git add ai-service/
git commit -m "feat: 创建 Python AI 微服务最小骨架（health check 接口）"
git push origin main
```

---

### Task 6: Next.js 前端最小骨架

**文件:**
- 创建: `frontend/package.json`
- 创建: `frontend/tsconfig.json`
- 创建: `frontend/next.config.ts`
- 创建: `frontend/tailwind.config.ts`
- 创建: `frontend/postcss.config.mjs`
- 创建: `frontend/src/app/layout.tsx`
- 创建: `frontend/src/app/page.tsx`
- 创建: `frontend/src/app/globals.css`

**Step 1: 用 create-next-app 初始化**

```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

> 注意：因为 `frontend/` 目录还不存在，create-next-app 会创建它。如果目录已存在则先删除或在项目根目录外执行后移入。

**Step 2: 替换 src/app/page.tsx 为最小首页**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">MindFlow</h1>
        <p className="mt-4 text-lg text-gray-600">
          AI 原生自适应学习平台
        </p>
      </div>
    </main>
  );
}
```

**Step 3: 验证能跑**

```bash
cd frontend && npm run build
```

预期：构建成功。

**Step 4: 提交**

```bash
git add frontend/
git commit -m "feat: 创建 Next.js 前端最小骨架"
git push origin main
```

---

### Task 7: Go 后端 Dockerfile

**文件:**
- 创建: `backend/Dockerfile`

**Step 1: 创建多阶段 Dockerfile**

```dockerfile
# ===== 开发阶段 =====
FROM golang:1.22-alpine AS dev

WORKDIR /app

# air 热重载
RUN go install github.com/air-verse/air@latest

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

EXPOSE 8080

CMD ["air", "-c", ".air.toml"]

# ===== 构建阶段 =====
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /mindflow-backend ./cmd/server/

# ===== 生产阶段 =====
FROM alpine:3.19 AS prod

RUN apk --no-cache add ca-certificates
COPY --from=builder /mindflow-backend /mindflow-backend

EXPOSE 8080

CMD ["/mindflow-backend"]
```

**Step 2: 创建 air 配置**

创建 `backend/.air.toml`:

```toml
root = "."
tmp_dir = "tmp"

[build]
cmd = "go build -o ./tmp/main ./cmd/server/"
bin = "./tmp/main"
include_ext = ["go", "tpl", "tmpl", "html"]
exclude_dir = ["tmp", "vendor"]
delay = 1000

[log]
time = false

[misc]
clean_on_exit = true
```

**Step 3: 提交**

```bash
git add backend/Dockerfile backend/.air.toml
git commit -m "chore: 添加 Go 后端 Dockerfile 和 air 热重载配置"
git push origin main
```

---

### Task 8: Python AI 微服务 Dockerfile

**文件:**
- 创建: `ai-service/Dockerfile`

**Step 1: 创建 Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 2: 提交**

```bash
git add ai-service/Dockerfile
git commit -m "chore: 添加 Python AI 微服务 Dockerfile"
git push origin main
```

---

### Task 9: Next.js 前端 Dockerfile

**文件:**
- 创建: `frontend/Dockerfile`

**Step 1: 创建多阶段 Dockerfile**

```dockerfile
# ===== 开发阶段 =====
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ===== 构建阶段 =====
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ===== 生产阶段 =====
FROM node:20-alpine AS prod

WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

**Step 2: 提交**

```bash
git add frontend/Dockerfile
git commit -m "chore: 添加 Next.js 前端 Dockerfile"
git push origin main
```

---

### Task 10: docker-compose.yml 编排所有服务

**文件:**
- 创建: `docker-compose.yml`

**Step 1: 创建 docker-compose.yml**

```yaml
services:
  # ===== 基础设施 =====
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-mindflow}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mindflow_dev}
      POSTGRES_DB: ${POSTGRES_DB:-mindflow}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - mindflow-pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-mindflow}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - mindflow-redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "${QDRANT_HTTP_PORT:-6333}:6333"
      - "${QDRANT_GRPC_PORT:-6334}:6334"
    volumes:
      - mindflow-qdrant:/qdrant/storage
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:6333/healthz"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ===== 应用服务 =====
  backend:
    build:
      context: ./backend
      target: dev
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT:-8080}:8080"
    volumes:
      - ./backend:/app
      - mindflow-memory:/data/memory
      - mindflow-uploads:/data/uploads
    environment:
      - BACKEND_PORT=8080
      - POSTGRES_DSN=postgres://${POSTGRES_USER:-mindflow}:${POSTGRES_PASSWORD:-mindflow_dev}@postgres:5432/${POSTGRES_DB:-mindflow}?sslmode=disable
      - REDIS_ADDR=redis:6379
      - QDRANT_ADDR=qdrant:6334
      - AI_SERVICE_ADDR=ai-service:8000
      - MEMORY_DIR=/data/memory
      - UPLOAD_DIR=/data/uploads
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_BASE_URL=${LLM_BASE_URL:-https://api.openai.com/v1}
      - LLM_MODEL=${LLM_MODEL:-gpt-4o}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      qdrant:
        condition: service_healthy

  ai-service:
    build:
      context: ./ai-service
    restart: unless-stopped
    ports:
      - "${AI_SERVICE_PORT:-8000}:8000"
    volumes:
      - ./ai-service:/app
      - mindflow-uploads:/data/uploads
    environment:
      - AI_SERVICE_PORT=8000
      - QDRANT_URL=http://qdrant:6333
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_BASE_URL=${LLM_BASE_URL:-https://api.openai.com/v1}
      - LLM_MODEL=${LLM_MODEL:-gpt-4o}
    depends_on:
      qdrant:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      target: dev
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT:-8080}
      - NEXT_PUBLIC_WS_URL=ws://localhost:${BACKEND_PORT:-8080}
    depends_on:
      - backend

volumes:
  mindflow-pg-data:
  mindflow-redis:
  mindflow-qdrant:
  mindflow-memory:
  mindflow-uploads:
```

**Step 2: 提交**

```bash
git add docker-compose.yml
git commit -m "feat: 添加 docker-compose.yml，编排全部 6 个服务"
git push origin main
```

---

### Task 11: 更新 CODEBUDDY.md — 添加全链路检查规则和 Docker 命令

**文件:**
- 修改: `CODEBUDDY.md`

**Step 1: 在"规则"章节末尾添加规则 3**

在规则 2 之后添加：

```markdown
### 3. 全链路检查，不做打补丁式修改

新增或修改逻辑时，必须顺着整条调用链路检查，确保一致性：

- **数据模型变更**：检查 Go model → PostgreSQL schema → Python schemas → 前端 types.ts 是否同步
- **API 接口变更**：检查 proto 定义 → Go handler → Python router → 前端 api.ts/ws.ts 是否一致
- **Agent 行为变更**：检查 Agent 实现 → Orchestrator 调度 → 记忆系统读写 → 前端展示是否衔接
- **配置变更**：检查 .env.example → docker-compose.yml → 各服务读取环境变量的代码是否对齐

禁止"先改一处跑通再说"的打补丁方式。每次修改必须把相关链路上的所有文件一起改完、一起提交。
```

**Step 2: 更新"常用命令 > 基础设施"为 Docker Compose 全服务命令**

替换基础设施部分：

```markdown
### Docker 全服务

```bash
cp .env.example .env               # 首次部署：复制环境变量模板
docker-compose up -d               # 启动所有服务（首次会自动构建镜像）
docker-compose down                # 停止所有服务
docker-compose up -d --build       # 重新构建镜像并启动
docker-compose logs -f backend     # 查看指定服务日志
docker-compose restart backend     # 重启指定服务
```
```

**Step 3: 提交**

```bash
git add CODEBUDDY.md
git commit -m "docs: 添加全链路检查规则，更新 Docker 命令"
git push origin main
```

---

### Task 12: 验证 — docker-compose up 一键启动

**Step 1: 复制 .env**

```bash
cp .env.example .env
```

**Step 2: 启动所有服务**

```bash
docker-compose up -d --build
```

**Step 3: 验证所有服务健康**

```bash
docker-compose ps
```

预期：6 个服务全部 running/healthy。

**Step 4: 验证 health check 接口**

```bash
curl http://localhost:8080/health
# 预期: {"status":"ok","service":"mindflow-backend"}

curl http://localhost:8000/health
# 预期: {"status":"ok","service":"mindflow-ai-service"}

curl http://localhost:3000
# 预期: HTML 页面包含 "MindFlow"
```

**Step 5: 验证持久化 volume**

```bash
docker volume ls | grep mindflow
```

预期：5 个 volume（pg-data, redis, qdrant, memory, uploads）。

**Step 6: 验证重启后数据不丢失**

```bash
docker-compose down
docker-compose up -d
docker-compose ps
```

预期：所有服务恢复正常，volume 数据保持。

---

## 执行顺序总结

| Task | 内容 | 产出 |
|------|------|------|
| 1 | .env.example | 环境变量模板 |
| 2 | .dockerignore | Docker 构建排除 |
| 3 | .gitignore | Git 忽略规则 |
| 4 | Go 后端骨架 | backend/cmd/server/main.go + go.mod |
| 5 | Python AI 微服务骨架 | ai-service/app/main.py + requirements.txt |
| 6 | Next.js 前端骨架 | frontend/ 完整初始化 |
| 7 | Go Dockerfile | backend/Dockerfile + .air.toml |
| 8 | Python Dockerfile | ai-service/Dockerfile |
| 9 | Next.js Dockerfile | frontend/Dockerfile |
| 10 | docker-compose.yml | 全服务编排 |
| 11 | 更新 CODEBUDDY.md | 新规则 + Docker 命令 |
| 12 | 验证 | 一键启动 + health check + 持久化 |
