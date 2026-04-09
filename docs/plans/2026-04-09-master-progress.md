# MindFlow 主进度文档

> 最后更新：2026-04-09
> 本文档综合 mempalace 分析与现有设计文档，作为项目唯一的进度与 TODO 总表。

## 一、项目现状

### 已完成

| 模块 | 完成内容 |
|------|---------|
| 基础设施 | Docker Compose 6 服务编排、生产/开发分离、volume 持久化 |
| Go 后端 | Hertz HTTP 服务、TutorAgent 苏格拉底对话、POST /api/chat、配置模块 |
| Python AI 微服务 | FastAPI 骨架、GET /health |
| 前端 | claude.ai 风格三态界面、Markdown + Mermaid 渲染、Vitest 测试基础设施 |
| 工程规范 | CODEBUDDY.md 规则（提交/重启/全链路/虚假数据/README 历史） |

### 当前模型

硅基流动 SiliconFlow，`Pro/zai-org/GLM-5.1`

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
  - 后端 POST /api/chat 改为 SSE（Server-Sent Events）流式响应
  - Go 后端：逐 token 写入 `text/event-stream`，每个 chunk 一个 `data:` 事件
  - 前端 useChat：用 `EventSource` 或 `fetch` + `ReadableStream` 接收
  - MessageBubble：AI 回复逐字追加渲染，产生打字机效果
  - 完成后仍保留完整消息用于 Markdown 渲染
- [x] **会话持久化**
  - PostgreSQL 建表：conversations、messages
  - Go 后端：GET /api/conversations、GET /api/conversations/:id
  - 前端侧栏接真实会话列表
- [x] **Orchestrator Agent**
  - 总调度器，根据上下文决定调 TutorAgent 还是其他 Agent
  - 基于关键词规则路由，当前只有 Tutor 可用
- [ ] **E2E 测试**（延后，统一补）
  - Playwright：用户发消息 → AI 引导式回复 → 刷新后会话仍在

### P1：资料理解

> 目标：上传 PDF，AI 理解并基于内容教学

- [x] Python AI 服务：文档解析（PyMuPDF）
- [x] Python AI 服务：Embedding 生成（sentence-transformers）
- [x] Qdrant 向量存储接入
- [x] Go AI 微服务 HTTP 客户端（service/ai_client.go）+ 单元测试
- [x] Content Agent 集成到 Orchestrator（LLM 语义路由）
- [x] 前端资料上传页面
- [ ] E2E：上传 PDF → AI 基于内容提问

### P2：诊断和记忆

> 目标：AI 能诊断错误、记住学生状态
> 借鉴 mempalace 分层记忆和时间知识图谱

- [x] **Diagnostic Agent**（TDD）
  - 分析学生回答，分类错误类型（概念错/方法错/粗心）
  - 输出诊断结构体，反馈给 Orchestrator
- [x] **Memory Agent + 分层记忆系统**（TDD）
  - L0 学生身份层（始终加载，~50 tokens）
  - L1 关键掌握度层（始终加载，~150 tokens）
  - L2 当前科目上下文（按需加载）
  - L3 历史深度搜索（按需加载，走 Qdrant）
  - Markdown 文件持久化：MEMORY.md + memory/YYYY-MM-DD.md
- [x] **时间知识图谱**
  - PostgreSQL 存储知识点掌握度三元组（学生、关系、概念、有效期、置信度）
  - 支持历史查询和遗忘曲线衰减
- [x] memory_search / memory_get / memory_write 工具函数
- [x] Dreaming sweep 定时任务（短期记忆 → 长期画像）+ 每日凌晨 3 点自动执行
- [x] 知识图谱可视化（前端 /knowledge 页面，颜色标注掌握度：绿/黄/红）
- [ ] E2E：跨 session 记忆连续性

### P3：出题和复习

> 目标：自动出题 + 遗忘曲线复习

- [x] SM-2 遗忘曲线算法（TDD）
- [x] Quiz Agent：基于资料和掌握度自动出题
- [x] Review Agent：遗忘曲线调度
- [x] Curriculum Agent：AI 主动规划每次会话内容（复习优先于新内容）
- [x] 复习计划日历（前端 /review 页面）
- [x] 学习仪表盘（前端 /dashboard 页面）
- [ ] E2E：遗忘曲线提醒 → 复习 → 更新掌握度

### P4：打磨和扩展

> 目标：产品化和可扩展性

- [ ] 用户系统（注册登录）
- [ ] 多用户数据隔离
- [ ] LLM 评估体系（对话质量、诊断准确率）
- [ ] MCP 工具集成（把记忆和教学能力暴露为 MCP 工具）
- [ ] 性能优化（缓存、连接池、批量处理）
- [ ] 移动端适配

### P5：借鉴"今天学点啥"（秘塔科技）的创新方向

> 参考产品：秘塔科技「今天学点啥」—— AI 活化知识应用
> 核心理念：将任何文档转化为沉浸式互动课程，从"信息囤积"到"对话式内化"

#### 5.1 沉浸式课件生成

- [ ] **文档 → PPT 课件自动生成**：上传 PDF/文档后，LLM 自动提取核心知识点，生成结构化 PPT 课件（含 SVG 动画、逻辑图、流程图）
- [ ] **语音讲解生成**：为每页 PPT 生成配套语音讲解（TTS），支持多种讲解风格（课堂、苏格拉底提问、故事模式等）
- [ ] **章节拆分与选择性学习**：自动将长文档拆分为章节，用户可选择感兴趣的章节生成课程

#### 5.2 个性化学习引擎增强

- [ ] **知识掌握度分级**：初学者/进阶者/专家三档，LLM 根据选择自动调整讲解深度和用词
- [ ] **多讲解风格**：扩展 TutorAgent 支持不同教学风格（严谨课堂、启发式提问、生活化比喻等），由 LLM 动态适配
- [ ] **智能推荐系统**：基于学习历史、答题数据、掌握度推荐下一步学习内容（替代手动选择）

#### 5.3 答题挑战与社交化

- [ ] **课后自动出题闯关**：每节课程结束自动触发答题挑战，答对解锁成就
- [ ] **答题 PK**：邀请好友进行知识 PK，增加竞争性和社交传播
- [ ] **错题本与解析**：答错时 LLM 生成详细解析，自动收录到错题本，纳入遗忘曲线复习

#### 5.4 学习内容多源输入

- [ ] **URL 抓取学习**：粘贴网页链接（公众号文章、博客、论文）自动提取内容转为课程
- [ ] **搜索即学习**：输入关键词，自动搜索相关资料并生成课程（结合 RAG）
- [ ] **视频内容提取**：支持 B 站/YouTube 视频链接，提取字幕/内容转为结构化课程

#### 5.5 学习成果可视化

- [ ] **学习书架**：已完成课程存入书架，支持随时复习
- [ ] **课程分享**：通过链接分享生成的课程给他人
- [ ] **学习进度仪表盘增强**：整合课程完成率、答题正确率、知识图谱覆盖率

### 已知待优化（Review 产出的技术债务）

> 非紧急，后续迭代中逐步消化

- [ ] `Store.WriteLongTermMemory` 非原子写入 → 改为 write-temp + `os.Rename`
- [ ] `Store` 层 `GetDailyLog`/`AppendDailyLog` 自身未校验 date 参数 → 下沉校验到 Store
- [ ] `Store` 文件读写无并发锁 → Memory Agent 和 Dreaming Sweep 可能竞态，加 `sync.RWMutex`
- [ ] LLM 调用缺少 `context.WithTimeout` → Dreaming Sweep / Route 等场景需加超时
- [ ] CORS AllowOrigins 硬编码 localhost → 从 config 读取
- [ ] AI 微服务客户端 health check 失败后无重试 → 加延迟初始化或重试
- [ ] `runDreamingSweep` 时间源 `time.Now()` 不可测试 → 注入 clock 接口
- [ ] 测试 Mock 依赖 prompt 文本关键词做分支 → 改为更明确的标识
- [ ] `main.go` 中 `aiClient` 为 `nil` 时 `ResourceHandler` 可能空指针 → 确认 Upload 内部有 nil 检查，或在路由注册时跳过该路由
- [ ] `dreaming.go` 步骤 4（写 MEMORY.md）成功但步骤 5（生成总结）失败时部分完成状态 → 实现幂等性校验或事务性操作
- [ ] `store.go` Search 返回整个日志文件内容拼入 LLM prompt 可能超 token → 改为返回匹配片段而非全文
- [ ] 侧栏“新建对话/删除当前会话”未同步清理 `?conversation=` URL 参数 → 统一改为路由级清理并补回归测试

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
