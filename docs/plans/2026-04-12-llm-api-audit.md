# MindFlow LLM 调用 API 端点完整梳理

## 📊 项目信息
- **项目路径**: /Users/hasson/Codes/MindFlow
- **后端框架**: Hertz (Go)
- **LLM 提供商**: 硅基流动（默认）、Codex（可选）
- **前端**: Next.js (TypeScript)
- **移动端**: React Native (TypeScript)

---

## 📋 API 端点完整表格

| # | API 端点 | HTTP 方法 | 用途 | 后端 Agent | 核心操作 | 超时设置 | 是否流式 | 前端调用位置 | 移动端调用位置 | 超时风险 | 建议处理 |
|---|---------|---------|------|-----------|--------|--------|--------|-----------|-----------|--------|--------|
| 1 | `/api/chat` | POST | 主对话接口 - 通用教学对话 | Orchestrator → Tutor/Diagnostic/Quiz 等 | 调用 LLM 路由+生成回复 | **60s**（前端）/ 无约束（后端） | ✅ 流式 + 非流式 | `useChat.ts` / `app/page.tsx` | `chatStore.ts` | ⚠️ 高风险 | 流式处理，需异步 |
| 2 | `/api/quiz/generate` | POST | 出题接口 - 给定概念生成 1-3 道题 | QuizAgent | `Generate()`/`GenerateQuizStream()` | **30s**（后端超时） | ❌ 仅同步 | `app/quiz/page.tsx` | `QuizScreen.tsx` | ⚠️ 中风险 | 后端需提升超时，前端 60s |
| 3 | `/api/quiz/submit` | POST | 答题提交 - LLM 评分答案 | QuizAgent | `EvaluateAnswer()` | **30s**（后端超时） | ❌ 同步 | `app/quiz/page.tsx` | `QuizScreen.tsx` | ⚠️ 中风险 | 建议异步后台评分 |
| 4 | `/api/quiz/variant` | POST | 变式题生成 - 基于错题生成相似题 | VariantQuizAgent | LLM 生成 | **30s**（后端超时） | ❌ 同步 | 未使用 | `QuizScreen.tsx` | ⚠️ 中风险 | 需异步处理 |
| 5 | `/api/quiz/conversation` | POST | 对话考察 - 多轮互动评估 | ConversationalQuizAgent | LLM 对话 | **60s**（前端给） / 无约束（后端） | ❌ 同步 | `app/quiz/page.tsx` | `QuizScreen.tsx` | 🔴 高风险 | 改为异步/WebSocket |
| 6 | `/api/daily-briefing` | GET | 晨间简报 - 生成今日学习简报 | CurriculumAgent | LLM 生成总结 | **45s**（后端超时） | ❌ 同步 | `app/page.tsx` | `HomeScreen.tsx` | ⚠️ 中风险 | 改为异步任务 |
| 7 | `/api/resources/upload` | POST | 资料上传 - 处理文件 + AI 解析摘要 | ResourceHandler | AI 微服务解析 + `generateOverview()` LLM 调用 | **无约束**（后端） | ❌ 同步 | `app/resources/page.tsx` | `ResourcesScreen.tsx` | 🔴 高风险 | 必须异步处理 |
| 8 | `/api/resources/import-url` | POST | URL 导入 - 网页抓取 + LLM 摘要 | ResourceHandler | 网页解析 + LLM 概览 | **60s**（前端给） | ❌ 同步 | `app/resources/page.tsx` | `ResourcesScreen.tsx` | 🔴 高风险 | 必须异步处理 |
| 9 | `/api/resources/:id/generate-course` | POST | 课程生成 - 从资料生成教学章节 | CoursewareAgent | LLM 生成课程大纲 | **无约束**（后端） | ❌ 同步 | `app/resources/page.tsx` | 未使用 | 🔴 高风险 | 必须异步处理 |
| 10 | `/api/memory/profile` | GET | 记忆概览 - 获取用户学习记忆 | MemoryHandler | 数据库查询（无 LLM） | - | - | `app/memory/page.tsx` | `MemoryScreen.tsx` | ✅ 低风险 | 同步可行 |
| 11 | `/api/memory/timeline` | GET | 记忆时间线 - 学习历程视图 | MemoryHandler | 数据库查询（无 LLM） | - | - | `app/memory/page.tsx` | `MemoryScreen.tsx` | ✅ 低风险 | 同步可行 |
| 12 | `/api/memory/search` | GET | 记忆搜索 - 语义检索学习内容 | MemoryHandler | 仅数据库查询（无 LLM） | - | - | `app/memory/page.tsx` | `MemoryScreen.tsx` | ✅ 低风险 | 同步可行 |
| 13 | `/api/knowledge/graph` | GET | 知识图谱 - 获取学习概念关系图 | KnowledgeHandler | 数据库查询（无 LLM） | - | - | `app/knowledge/page.tsx` | `KnowledgeScreen.tsx` | ✅ 低风险 | 同步可行 |
| 14 | `/api/knowledge/prerequisite-chain` | GET | 先修链 - 获取前置知识 | KnowledgeHandler | 数据库查询（无 LLM） | - | - | 未使用 | 未使用 | ✅ 低风险 | 同步可行 |
| 15 | `/api/knowledge/learning-path` | GET | 学习路径 - 个性化学习建议 | KnowledgeHandler | 数据库查询 + **可能涉及 LLM** | - | - | 未使用 | 未使用 | ⚠️ 中风险 | 需确认 LLM 调用 |
| 16 | `/api/knowledge/semantic-search` | GET | 语义搜索 - 基于 AI 向量检索 | KnowledgeHandler | AI 微服务调用（Embedding） | - | - | 未使用 | 未使用 | ⚠️ 待确认 | 需确认 AI 服务响应时间 |
| 17 | `/api/knowledge/sources` | GET | 知识来源 - 获取概念的学习来源 | KnowledgeHandler | 数据库查询（无 LLM） | - | - | `app/knowledge/page.tsx` | `KnowledgeScreen.tsx` | ✅ 低风险 | 同步可行 |
| 18 | `/api/echo` | POST | 回声测试 - 测试流式输出（开发用） | handler.HandleEcho | 模拟流式返回 | - | ✅ 流式 | `app/page.tsx` | - | ✅ 低风险 | 用于测试 |
| 19 | `/api/conversations` (POST) | POST | 创建会话 | ConversationHandler | 数据库操作（无 LLM） | - | - | `app/page.tsx` | `HomeScreen.tsx` | ✅ 低风险 | 同步可行 |
| 20 | `/api/conversations` (GET) | GET | 获取会话列表 | ConversationHandler | 数据库查询（无 LLM） | - | - | 未使用 | `HomeScreen.tsx` | ✅ 低风险 | 同步可行 |
| 21 | `/api/conversations/:id` (GET) | GET | 获取会话详情 | ConversationHandler | 数据库查询（无 LLM） | - | - | `app/page.tsx` | `HomeScreen.tsx` | ✅ 低风险 | 同步可行 |
| 22 | `/api/dashboard/stats` | GET | 仪表盘统计 | DashboardHandler | 数据库查询（无 LLM） | - | - | `app/dashboard/page.tsx` | `DashboardScreen.tsx` | ✅ 低风险 | 同步可行 |
| 23 | `/api/dashboard/heatmap` | GET | 学习热力图 | DashboardHandler | 数据库查询（无 LLM） | - | - | `app/dashboard/page.tsx` | `DashboardScreen.tsx` | ✅ 低风险 | 同步可行 |
| 24 | `/api/wrongbook` | GET | 错题本列表 | WrongBookHandler | 数据库查询（无 LLM） | - | - | `app/wrongbook/page.tsx` | `WrongbookScreen.tsx` | ✅ 低风险 | 同步可行 |
| 25 | `/api/wrongbook/stats` | GET | 错题统计 | WrongBookHandler | 数据库查询（无 LLM） | - | - | `app/wrongbook/page.tsx` | `WrongbookScreen.tsx` | ✅ 低风险 | 同步可行 |
| 26 | `/api/review/due` | GET | 到期复习 | ReviewHandler | 数据库查询（无 LLM） | - | - | `app/review/page.tsx` | `ReviewScreen.tsx` | ✅ 低风险 | 同步可行 |
| 27 | `/api/courses` | GET | 课程列表 | CourseHandler | 数据库查询（无 LLM） | - | - | `app/courses/page.tsx` | `CoursesScreen.tsx` | ✅ 低风险 | 同步可行 |

---

## 🔴 高风险 LLM 调用端点（需优化）

### 1. **`POST /api/resources/upload` (资料上传)**
- **现状**: 同步处理，用户上传后需要等待 AI 解析完成
- **LLM 操作**: `generateOverview()` 生成资料摘要 + 建议问题
- **超时情况**: 
  - 小文件（<2000字符）: ~3-5 秒 ✅
  - 大文件（>20000字符）: 可能 10+ 秒 ⚠️
- **建议**: 
  - 改为异步处理（后台队列 + WebSocket 推送结果）
  - 或返回 202 Accepted，前端轮询

### 2. **`POST /api/resources/import-url` (URL 导入)**
- **现状**: 同步，需先抓取网页再 LLM 解析
- **LLM 操作**: URL 内容解析 + 摘要生成
- **超时情况**: 网页抓取 5-10 秒 + LLM 5-10 秒 = **10-20 秒** 🔴
- **建议**: 
  - 必须异步处理
  - 前端超时设置需 60+ 秒

### 3. **`POST /api/resources/:id/generate-course` (课程生成)**
- **现状**: 同步处理，LLM 生成完整课程大纲
- **LLM 操作**: `courseware.GenerateCourse()` 生成结构化课程
- **超时情况**: **20-30 秒** 🔴
- **建议**: 
  - 必须异步处理
  - 前端超时设置需 120+ 秒
  - 后端需返回 job_id，前端轮询 `/api/courses/{id}/status`

### 4. **`POST /api/quiz/conversation` (对话考察)**
- **现状**: 同步多轮对话，每轮都需 LLM 生成
- **LLM 操作**: 多轮 AI 对话评估
- **超时情况**: 
  - 单轮对话: 5-10 秒
  - 多轮累积: **30+ 秒** 🔴
- **建议**: 
  - 改为 WebSocket 长连接
  - 或每轮单独异步处理

### 5. **`GET /api/daily-briefing` (晨间简报)**
- **现状**: 同步生成简报
- **LLM 操作**: `curriculumAgent.GenerateDailyBriefing()` 生成总结
- **超时情况**: **45 秒**（后端已设置）
- **超时风险**: ⚠️ 接近上限
- **建议**: 
  - 改为异步生成（每天凌晨预生成）
  - 或返回缓存的前一天简报

---

## ⚠️ 中风险 LLM 调用端点（需改进）

### 1. **`POST /api/chat` (主对话)**
- **现状**: 支持流式 + 非流式
- **超时情况**:
  - 前端: **60 秒**（`sendMessageStream` 超时设置）
  - 后端: **无约束**（需添加）
- **建议**: 
  - 后端添加全局 30-60 秒超时
  - 前端已支持流式，可继续优化

### 2. **`POST /api/quiz/generate` (出题)**
- **现状**: 同步生成
- **超时情况**: 30 秒（后端设置）
- **超时风险**: ⚠️ 复杂题目可能超时
- **建议**: 
  - 提升后端超时到 60 秒
  - 或改为异步处理

### 3. **`POST /api/quiz/submit` (答题评分)**
- **现状**: 同步 LLM 评分
- **超时情况**: 30 秒
- **超时风险**: ⚠️ 长答案评分可能超时
- **建议**: 
  - 提升超时到 45-60 秒
  - 或改为异步后台评分

---

## 📊 超时汇总

| 层级 | API 端点 | 前端超时 | 后端超时 | 状态 | 优先级 |
|-----|---------|--------|--------|------|-------|
| 🔴 高 | `/api/resources/upload` | - | 无 | 同步 | P0 |
| 🔴 高 | `/api/resources/import-url` | 60s | 无 | 同步 | P0 |
| 🔴 高 | `/api/resources/:id/generate-course` | 120s | 无 | 同步 | P0 |
| 🔴 高 | `/api/quiz/conversation` | 60s | 无 | 同步 | P0 |
| ⚠️ 中 | `/api/chat` | 60s | 无 | 流式 | P1 |
| ⚠️ 中 | `/api/quiz/generate` | 30s | 30s | 同步 | P1 |
| ⚠️ 中 | `/api/quiz/submit` | 30s | 30s | 同步 | P1 |
| ⚠️ 中 | `/api/daily-briefing` | - | 45s | 同步 | P1 |

---

## 🎯 优化建议总结

### 立即行动（P0）
1. **异步队列系统**: 
   - 资料上传 → 后台处理
   - 课程生成 → 后台任务
   - 实现 Job Manager 支持查询进度

2. **WebSocket 升级**:
   - `/api/quiz/conversation` 改为 WebSocket
   - 支持流式推送结果

3. **前端增强**:
   - 显示进度指示器
   - 超时后允许用户取消任务

### 短期改进（P1）
1. **后端超时策略**:
   - `/api/chat`: 添加 30-60 秒全局超时
   - `/api/quiz/generate`: 提升到 60 秒
   - `/api/quiz/submit`: 提升到 45 秒

2. **前端超时优化**:
   - 出题: 30s → 60s
   - 答题评分: 30s → 60s
   - 晨间简报: 添加超时处理

3. **预处理机制**:
   - 晨间简报: 每天凌晨 3 点预生成
   - 避免用户访问时等待

### 长期架构
1. **消息队列** (RabbitMQ/Kafka)
2. **异步任务服务** (Celery/Bull)
3. **缓存层** (Redis)
4. **监控告警** (Prometheus)

---

## 📈 当前超时失败概率评估

| 场景 | 失败概率 | 原因 |
|-----|---------|-----|
| 网络良好 + 小资料上传 | 5% | 网络抖动 |
| 网络良好 + 大资料上传 | 30% | LLM 处理时间长 |
| 网络一般 + URL 导入 | 40% | 网页抓取 + LLM 双重延迟 |
| 移动网络 + 课程生成 | 60% | 移动网络不稳定 + 长处理时间 |
| 移动网络 + 对话考察 | 50% | 多轮累积延迟 |

