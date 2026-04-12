# CODEBUDDY.md

本文件为 CodeBuddy Code 在此仓库中工作时提供指引。

## 项目概述

MindFlow 是一个 AI 苏格拉底式学习系统。学生上传学习资料，AI 自动解析内容、构建知识图谱、通过苏格拉底式对话教学、诊断薄弱点，并基于遗忘曲线安排复习。

设计文档：`docs/plans/2026-04-09-mindflow-design.md`

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TypeScript, Next.js 16, Tailwind CSS 4 |
| 后端 | Go 1.26, Eino（Agent 编排）, Hertz（HTTP/SSE）, pgx |
| AI 微服务 | Python 3.11, FastAPI, PyMuPDF |
| 数据库 | PostgreSQL 16, Qdrant, Redis 7 |

## 规则（必须遵守，没有例外）

### 1. 提交前必须验证

**不验证不提交。** 每次 `git commit` 前必须确认：
- `go build ./...` 编译通过
- `go test ./...` 测试通过
- `npm run build` 前端构建通过
- `npm run lint` 无错误
- 只要修改了移动端(`mobile`)，必须重新安装并在 Android 模拟器中打开实际验证
- **手动或自动验证改动的功能真正能用**（不是"代码逻辑上应该能用"）

### 2. 全链路检查

改一个功能时，必须顺着整条链路检查所有相关文件：
- 后端改了 → 前端对应的 API 调用、类型、UI 是否同步
- 前端改了 → 后端对应的接口、数据结构是否匹配
- 数据库表改了 → model / repository / handler / 前端类型 全部同步
- **前端(Web)改了 → 移动端(mobile)对应的页面、组件、API 调用、类型必须同步对齐**
- **移动端(mobile)改了 → 前端(Web)对应功能必须同步对齐**

**禁止只改一半就提交。Web 端和移动端必须保持功能和 UI 一致性。**

### 3. 不展示虚假数据

- 没有真实数据时展示空态，不编造假数据
- 按钮/链接必须有实际功能，不放无功能的占位按钮
- 全部使用中文，不出现英文 placeholder 或文案

### 4. 提交前必须跑 /review

每轮代码修改完成后，必须运行 `/review` 做隔离上下文的代码审查：
1. 写完代码 + 验证通过
2. 运行 `/review`
3. **严重** 问题必须修复后再次 `/review`
4. **警告** 问题视情况修复或记录
5. Review 通过后再 `git commit && git push`

`/review` 时必须重点检查：只要涉及前端(Web)或客户端(mobile)修改，两边对应的页面、组件、API 调用、类型是否已经同步对齐。

### 5. 中文 commit + push

```
<类型>: <简要描述>
```
类型：feat / fix / test / refactor / docs / chore

### 6. 子 Agent 结果必须落文件

启动子 agent 并行执行任务时，每个 agent 返回的结果必须保存为项目文件（通常在 `docs/` 目录下）。文件开头必须注明：
- **任务**：这次任务是干嘛的
- **执行时间**：什么时候执行的

### 7. 依赖变化需重建镜像

源码改动 HMR 自动生效。`package.json` / `requirements.txt` / `go.mod` 变化时需 `docker compose up -d --build <服务名>`。

## 常用命令

```bash
# Go 后端
cd backend && go build ./... && go test ./...

# 前端
cd frontend && npm run build && npm run lint && npm test

# Docker
docker compose up -d                    # 本地开发
docker compose -f docker-compose.yml up -d  # 部署模式
docker compose restart backend          # 重启服务
docker compose logs -f backend          # 查看日志
```
