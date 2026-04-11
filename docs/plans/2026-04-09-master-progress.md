# MindFlow 主进度文档

> 最后更新：2026-04-11
> 本文档综合 mempalace 分析与现有设计文档，作为项目唯一的进度与 TODO 总表。

## 一、项目现状

### 已完成

| 模块 | 完成内容 |
|------|---------|
| 基础设施 | Docker Compose 6 服务编排、生产/开发分离、volume 持久化 |
| Go 后端 | Hertz HTTP 服务、9 个 Agent 编排（Orchestrator/Tutor/Diagnostic/Memory/Content/Courseware/Quiz/Review/Curriculum）|
| Python AI 微服务 | FastAPI 6 个接口、知识点向量化（Qdrant）|
| 前端 | 10 个页面路由（聊天/资料/知识图谱/记忆/仪表盘/复习/测验/错题本/设置/课程详情）|
| 工程规范 | CLAUDE.md/CODEBUDDY.md 规则、/review 隔离代码审查 |

### 当前模型

硅基流动 SiliconFlow（默认），`Pro/zai-org/GLM-5.1`。可选 Codex（GPT-5.4），设置页热切换。

---

## 二、mempalace 借鉴要点

基于 https://github.com/milla-jovovich/mempalace 深度分析，以下设计思路纳入 MindFlow 后续实施：

### 2.1 分层记忆加载（借鉴 mempalace L0-L3）

| 层级 | MindFlow 映射 | Token 预算 | 加载时机 |
|------|-------------|-----------|---------|
| L0 | 学生身份（姓名、偏好、学习风格） | ~50 | 每次会话始终加载 |
| L1 | 关键掌握度摘要（已掌握/薄弱点 Top 10） | ~150 | 每次会话始终加载 |
| L2 | 当前科目/概念上下文 | 按需 | 进入学习主题时 |
| L3 | 历史学习记录深度搜索 | 按需 | 诊断/复习时显式查询 |

### 2.2 宫殿结构映射知识图谱

| mempalace 层级 | MindFlow 映射 | 示例 |
|---|---|---|
| Wing | 学科 | 数学、物理、编程 |
| Room | 知识单元 | 特征值分解、链式法则 |
| Hall | 知识类型 | 概念、定理、方法、易错点 |
| Tunnel | 跨学科连接 | 物理中的微积分应用 |

### 2.3 时间知识图谱

借鉴 mempalace 的时间三元组设计，知识点掌握度带时间维度：
- 事实有有效期（"2026-04-05 掌握矩阵乘法，置信度 0.92"）
- 支持历史查询（"一周前的掌握度是多少"）
- 遗忘曲线自动衰减置信度

### 2.4 不采纳的设计

| mempalace 设计 | 不采纳原因 |
|---|---|
| AAAK 有损压缩 | LongMemEval 分数下降 12.4%，学习场景不可接受 |
| 扁平三元组图谱 | MindFlow 需要多跳推理（前置概念→当前概念→后续概念） |
| 纯 CLI 交互 | MindFlow 面向学生，需要 Web 界面 |

---

## 三、分阶段 TODO

### P0：核心教学循环补完

> 目标：完整的苏格拉底对话闭环，会话可持久化

- [x] **SSE 流式输出 + 打字机效果**
- [x] **会话持久化**（PostgreSQL conversations/messages 表）
- [x] **Orchestrator Agent**（LLM 语义路由）
- [ ] **E2E 测试**（延后，统一补）

### P1：资料理解

- [x] Python AI 服务：文档解析（PyMuPDF）
- [x] Python AI 服务：Embedding 生成
- [x] Qdrant 向量存储接入
- [x] Go AI 微服务 HTTP 客户端 + 单元测试
- [x] Content Agent 集成到 Orchestrator（LLM 语义路由）
- [x] 前端资料上传页面
- [ ] E2E：上传 PDF → AI 基于内容提问

### P2：诊断和记忆

- [x] **Diagnostic Agent**（5+3 错误分类体系）
- [x] **Memory Agent + 分层记忆系统**（L0-L3 四层）
- [x] **时间知识图谱**（PostgreSQL 掌握度三元组 + 遗忘衰减）
- [x] memory_search / memory_get / memory_write 工具函数
- [x] Dreaming sweep 定时任务
- [x] 知识图谱可视化（前端 /knowledge 页面）
- [ ] E2E：跨 session 记忆连续性

### P3：出题和复习

- [x] **FSRS 算法**（替代 SM-2，自适应间隔重复）
- [x] **Quiz Agent**：Bloom 认知分类法出题 + 对话式考察 + Anki 卡片模式
- [x] **Review Agent**：遗忘曲线调度 + 易混淆概念交错复习
- [x] **Curriculum Agent**：AI 晨间简报 + 拓扑排序学习路径
- [x] 复习计划日历 + 独立复习答题页面（FSRS 四按钮评分）
- [x] 学习仪表盘（热力图 + 掌握度环形图 + 薄弱点行动按钮）
- [ ] E2E：遗忘曲线提醒 → 复习 → 更新掌握度

### P4：优化功能（docs/plans/12-优化功能点技术实现方案.md）

> P0 全部完成 ✅ | P1 全部完成 ✅ | P2 大部分完成

**P0 — 必须做（7/7 ✅）**
- [x] P0-1 FSRS 算法迁移（替换 SM-2）
- [x] P0-2 苏格拉底对话 Prompt 升级（IARA/CARA/SER 框架）
- [x] P0-3 错误诊断精细化（5+3 分类体系）
- [x] P0-4 提示词注入防护（四层防御）
- [x] P0-5 知识点提取 Prompt 升级（bloom_level/importance/多关系）
- [x] P0-6 错题变式题系统（6 种变式类型）
- [x] P0-7 错题自动收集 + 错题本页面

**P1 — 重要（11/11 ✅）**
- [x] P1-9 Bloom 分类法出题（6 级认知层级自动匹配）
- [x] P1-10 AI 晨间简报（今日学习计划）
- [x] P1-11 错误根源追踪（递归 CTE 前置知识链）
- [x] P1-12 基于拓扑排序的学习路径生成（Kahn 算法）
- [x] P1-13 学习仪表盘重设计（热力图 + 环形图）
- [x] P1-14 源文件引用锚定
- [x] P1-15 上传后自动概览（摘要 + 建议问题）
- [x] P1-16 复习体验优化（独立答题页 + FSRS 四按钮）
- [x] P1-17 考试模式（考试计划 + 加速复习）
- [x] P1-18 分块提取 + 合并去重
- [x] P1-19 对话式考察模式（AI 自主结束 + 综合评分）

**P2 — 锦上添花（7/7 ✅）**
- [x] P2-20 知识点向量化（Qdrant 语义搜索）
- [x] P2-21 教学风格动态自适应（DetectTeachingLevel）
- [x] P2-22 多格式资料支持（docx/pptx + 文本粘贴）
- [x] P2-23 知识图谱交互增强（力模拟/节点筛选）
- [x] P2-24 教学风格可选（设置页三种风格）
- [x] P2-25 易混淆概念交错复习
- [x] P2-26 资料全链路关联（knowledge_source_links 表）

### P5：打磨和扩展

- [x] **记忆页**（/memory）
- [x] 用户系统（注册/登录/JWT）
- [x] 多用户数据隔离（user_id 字段 + Repository 过滤）
- [x] LLM 评估体系（异步质量评分 + 统计 API）
- [x] 性能优化（晨间简报 30 分钟缓存 + 仪表盘 5 分钟缓存）
- [ ] iOS 原生客户端（Swift/SwiftUI，复用后端 API）
- [ ] E2E 测试（Playwright 端到端）
- [ ] 配置一致性修复（LLM_MODEL 默认值统一、CORS 链路补齐）

### 已知待优化（Review 产出的技术债务）

> 已修复

- [x] `Store.WriteLongTermMemory` 非原子写入 → 改为 write-temp + `os.Rename`
- [x] `Store` 层 `GetDailyLog`/`AppendDailyLog` 自身未校验 date 参数 → 下沉校验到 Store
- [x] `Store` 文件读写无并发锁 → Memory Agent 和 Dreaming Sweep 可能竞态，加 `sync.RWMutex`
- [x] LLM 调用缺少 `context.WithTimeout` → AI 客户端已有 120s 超时
- [x] CORS AllowOrigins 硬编码 localhost → 从 config 读取 `CORS_ORIGINS` 环境变量
- [x] AI 微服务客户端 health check 失败后无重试 → 加 3 次重试 + 退避
- [x] `runDreamingSweep` 时间源 `time.Now()` 不可测试 → 接受当前方案（单用户产品）
- [x] 测试 Mock 依赖 prompt 文本关键词做分支 → 接受当前方案（不影响功能）
- [x] `main.go` 中 `aiClient` 为 `nil` 时 `ResourceHandler` 可能空指针 → Upload 内部已有 nil 检查
- [x] `dreaming.go` 步骤 4/5 部分完成 → 接受当前方案（幂等性后续优化）
- [x] `store.go` Search 返回整个日志文件内容拼入 LLM prompt 可能超 token → 改为返回匹配片段
- [x] 侧栏"新建对话/删除当前会话"未同步清理 URL 参数 → MainShell 已统一处理
- [x] 前端 Suspense 包裹 → layout.tsx 全局 Suspense

> 新发现待处理

- [ ] `/api/settings/provider` 可被任意前端用户切换全局 LLM provider → 至少限制为管理员/本地开发使用，或改成按用户/会话维度存储
- [ ] `docker-compose.yml` 将 `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` 硬编码为 `localhost` → 远程部署前端会回连用户本机，需改为可配置公网地址或相对路径
- [ ] `README.md` / `docker-compose.yml` / `backend/internal/config/config.go` 的 `LLM_MODEL` 默认值不一致 → 统一文档、Compose 与代码默认模型
- [ ] `CODEX_MODEL` / `CORS_ORIGINS` 配置链路不完整 → 补齐 `.env.example` 与 `docker-compose.yml` 环境变量透传

---

## 四、相关设计文档索引

| 文档 | 用途 | 状态 |
|------|------|------|
| 2026-04-09-mindflow-design.md | 总体架构设计 | 有效 |
| 2026-04-09-docker-infrastructure.md | Docker 基础设施实施 | 已完成 |
| 2026-04-09-builder-skills-global-install-design.md | Builder-Skills 安装设计 | 已完成 |
| 2026-04-09-builder-skills-install-and-frontend-redesign.md | 前端重写实施 | 已完成 |
| 2026-04-09-mindflow-ui-redesign-design.md | 前端 B+C 融合设计 | 已完成 |
| 2026-04-09-mindflow-ui-redesign-implementation.md | 前端重构实施 | 已完成 |
| 2026-04-09-claude-like-chat-rendering-design.md | 会话渲染设计 | 已完成 |
| 2026-04-09-claude-like-chat-rendering-implementation.md | 会话渲染实施 | 已完成 |
| 2026-04-09-mempalace-analysis.md | mempalace 分析报告 | 参考文档 |
| **本文档** | 主进度与 TODO 总表 | **当前有效** |
