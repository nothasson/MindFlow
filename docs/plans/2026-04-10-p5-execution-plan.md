# P5 执行计划（推荐方案）

## 目标
把 `docs/plans/2026-04-09-master-progress.md:142` 定义的 P5 落成一个**单用户、本地优先**的最小闭环：

**多源资料输入 → 章节化课程生成 → 苏格拉底式学习/自动出题 → 书架与仪表盘可视化**

## 推荐切入
**不要一次性做完整 P5。** 先补齐现有“资料进入系统”的基座，再按闭环顺序推进：

1. 先补**资料持久化 + 向量入库 + 知识点提取**，因为当前上传链路仍有硬缺口：
   - `backend/internal/handler/resource.go` 只生成 embedding，未真正 upsert
   - `ai-service/app/models/schemas.py` 已有 `ExtractRequest/ExtractResponse`，但还没有 `/extract` 实现
   - 前端 `frontend/src/app/resources/page.tsx` 只能上传并展示单次结果，没有资料资产沉淀
2. 首版课件不要直接做 PPT/TTS，先做**章节化 Markdown 课程**，避免过度设计，更符合本地优先
3. P5 中与多人协作/传播强相关的能力延后：
   - `5.3` 的“答题 PK”延后
   - `5.5` 的“外链课程分享”延后

## 分阶段实施

### Phase 0：补齐资料基座（先做）
**目标**：让“上传/抓取进来的资料”真正成为系统内可检索、可追踪、可复用的学习资产。

**后端/AI 服务**
- 修改 `backend/internal/handler/resource.go`
  - 上传后除了 `ParseDocument` / `Embed`，还要真正写入向量库
  - 生成稳定的 `resource_id`
  - 返回结构中补充资源标识与处理状态
- 修改 `backend/internal/service/ai_client.go`
  - 增加 `Upsert` / `ExtractKnowledgePoints` / `ParseURL`（后续 Phase 1 复用）
- 修改 `ai-service/app/main.py`
  - 注册新的路由
- 修改 `ai-service/app/models/schemas.py`
  - 补齐上传资源、知识点提取、课程生成所需 schema
- 新增 AI 路由/服务
  - `ai-service/app/routers/extract.py`
  - `ai-service/app/services/extractor.py`
  - 向量 upsert 对应路由（可放入现有 `search`/`embed` 体系，也可拆新路由）
- 修改 `backend/internal/repository/knowledge.go`
  - 增加写入知识点/关系的方法，不只读图谱
- 新增 migration
  - `resources`：记录文件名、来源类型、处理状态、字符数、分块数、创建时间
  - `courses`（可先最小字段）或把课程草稿先挂在 `resources`

**前端**
- 修改 `frontend/src/lib/types.ts`
  - 扩展 `ResourceUploadResult`
- 修改 `frontend/src/lib/api.ts`
  - 对齐新的资源响应结构
- 修改 `frontend/src/app/resources/page.tsx`
  - 从“单次上传结果页”升级为“资源入口 + 最近上传结果”

**完成标准**
- PDF/TXT/MD 上传后，资源有持久化记录
- 文本块真正写入向量库
- 能自动提取知识点并进入知识图谱数据源

---

### Phase 1：实现 P5.4 的首个输入源——URL 抓取学习
**目标**：把“文件上传”扩展到“网页链接直接变课程原料”。

**实现方式**
- 只做**URL 抓取**，不先做“搜索即学习/视频提取”
- 抓取结果统一转成与文档上传相同的资源处理管线

**关键路径**
- 后端：
  - `backend/internal/handler/resource.go` 或新增 `backend/internal/handler/source.go`
  - `backend/internal/service/ai_client.go`
- AI 服务：
  - 新增 `ai-service/app/routers/url.py`
  - 新增 `ai-service/app/services/url_parser.py`
- 前端：
  - `frontend/src/app/resources/page.tsx` 增加 URL 输入模式
  - `frontend/src/lib/api.ts` 增加 URL 导入 API
  - `frontend/src/lib/types.ts` 增加 URL 资源类型

**边界**
- 首版仅支持公开网页正文提取
- 不做登录态网站、反爬、复杂站点适配

**完成标准**
- 用户粘贴 URL 后，可以生成与上传文档一致的资源记录
- 后续对话与课程生成可直接使用该资源

---

### Phase 2：实现 P5.1 的最小课件形态——章节化课程（非 PPT）
**目标**：把资源从“可检索文本”升级为“可学习课程”。

**推荐首版形态**
- 不是 PPT，不做 SVG 动画
- 先做：
  - 章节拆分
  - 每章学习目标
  - 章节摘要
  - 章节关键问题
  - 可进入对话学习

**关键路径**
- 后端：
  - `backend/internal/agent/content.go`：支持“按资源/章节”提供上下文，而不是全局 `documents`
  - 可新增 `backend/internal/agent/courseware.go`
  - 新增课程 handler / service / repository
- AI 服务：
  - 复用 `extract` 能力，增加课程大纲/章节拆分生成
- 前端：
  - `frontend/src/app/resources/page.tsx`：资源详情进入课程
  - 可新增 `frontend/src/app/courses/[id]/page.tsx`
  - `frontend/src/app/page.tsx`：支持从课程章节跳转进入对话学习

**数据模型**
- `courses`
- `course_sections`
- section 与 resource 的关联

**完成标准**
- 一个资源可生成一个课程
- 课程包含章节列表
- 用户能选择章节进入学习，而不是只看原始解析文本

---

### Phase 3：实现 P5.2 的最小个性化增强
**目标**：在不重做整套 Agent 架构的前提下，让同一课程对不同水平/风格产生差异化教学。

**首版范围**
- 掌握度分级：初学 / 进阶 / 专家
- 教学风格：课堂讲解 / 苏格拉底追问 / 生活化比喻
- 课程推荐先做**规则极少 + LLM 决策**的单用户版本

**关键路径**
- 后端：
  - `backend/internal/agent/content.go`：把资源/章节上下文 + 用户水平/风格写入 system prompt
  - `backend/internal/agent/quiz.go`：按掌握度出不同难度题
  - 记忆/掌握度写入路径（与知识图谱表对齐）
  - 如有必要新增 `recommendation` 相关 service/agent
- 前端：
  - `frontend/src/app/page.tsx`：学习前选择/切换讲解风格
  - `frontend/src/lib/types.ts` / `frontend/src/lib/api.ts`：传输课程上下文与学习偏好

**边界**
- 不做多人画像
- 不做复杂推荐系统
- 推荐以“下一个该学哪章/该复习哪章”为主

**完成标准**
- 同一章节在不同档位/风格下生成明显不同的教学引导
- 系统能推荐下一步学习内容或复习内容

---

### Phase 4：实现 P5.5 的单用户可视化
**目标**：让用户看到真实的课程资产和学习进展，且不展示假数据。

**首版范围**
- 学习书架
- 课程完成率
- 章节完成度
- 答题正确率
- 仪表盘真实数据接入

**关键路径**
- 前端：
  - 修改 `frontend/src/app/dashboard/page.tsx`：去掉硬编码统计，改接真实 API
  - 修改 `frontend/src/app/resources/page.tsx`：增强为书架/资源入口
  - `frontend/src/app/knowledge/page.tsx`：必要时增加从知识点跳回课程/章节的入口
- 后端：
  - 新增 dashboard stats handler / repository 聚合查询
  - `backend/internal/handler/knowledge.go` 保持图谱查询一致，必要时补课程/资源维度过滤

**完成标准**
- 仪表盘所有指标来自真实数据源
- 用户能在书架中看到已生成课程并继续学习/复习

---

### Phase 5：实现 P5.3 的学习闭环部分（只做单人，不做 PK）
**目标**：把课程学习自然接到“检验 → 错题沉淀 → 复习”。

**首版范围**
- 课后自动出题闯关
- 错题解析
- 错题纳入复习队列

**关键路径**
- 后端：
  - `backend/internal/agent/quiz.go`：从纯文本题面升级为结构化题目生成
  - 新增 quiz/result/wrongbook/review 相关 handler 与 repository
- 前端：
  - 课程详情页或学习页内嵌“章节测验”
  - `frontend/src/app/review/page.tsx` 后续接入真实错题/复习数据

**明确延后**
- 答题 PK：依赖多用户，不符合当前“单用户/本地优先”

**完成标准**
- 课程结束后自动进入测验
- 错题可查看解析，并出现在后续复习中

## 明确延后项
### 暂不做
- `5.1` 真正 PPT 导出、SVG 动画、TTS 配音
- `5.3` 答题 PK
- `5.5` 面向他人的外链分享
- `5.4` 视频提取
- `5.4` 全自动联网搜索学习

### 延后原因
- 与“单用户/本地优先”不完全一致，或依赖外部服务较重
- 当前代码基座更适合先做“资源 → 课程 → 学习 → 复习”的主闭环
- 先把真实数据链路打通，比先堆展示层能力更重要

## 关键数据与接口调整
### 建议新增/调整的数据对象
- `resources`
  - `id`, `source_type`, `title`, `original_filename`, `source_url`, `content_text`, `pages`, `chunk_count`, `status`, `created_at`
- `courses`
  - `id`, `resource_id`, `title`, `summary`, `difficulty_level`, `style`, `created_at`
- `course_sections`
  - `id`, `course_id`, `title`, `summary`, `order_index`, `learning_objectives`, `question_prompts`
- `course_progress`
  - `course_id`, `section_id`, `completed`, `mastery_snapshot`, `updated_at`
- `quiz_attempts` / `wrong_book`
  - 用于课后测验与错题沉淀

### 建议新增/调整的 API
- `POST /api/resources/upload`
- `POST /api/resources/import-url`
- `GET /api/resources`
- `GET /api/resources/:id`
- `POST /api/resources/:id/extract`
- `POST /api/resources/:id/generate-course`
- `GET /api/courses/:id`
- `POST /api/courses/:id/learn`
- `GET /api/dashboard/stats`
- `POST /api/courses/:id/quiz`

## 测试策略
遵循仓库 TDD 约束，按阶段补测试。

### Go
- `resource handler`：上传、URL 导入、异常分支、AI 服务失败分支
- `repository`：resources/courses/progress/quiz 聚合查询
- `agent`：课程上下文注入后 prompt/输入组装是否符合预期
- `dashboard`：真实统计 API 返回值

### Python
- `extractor`：知识点提取结构正确
- `url parser`：正文提取成功/失败
- 课程生成服务：章节拆分、摘要、学习目标输出结构

### Frontend
- `resources` 页：文件上传 / URL 导入 / 空态 / 错误态
- `dashboard` 页：真实数据展示与空态
- `course` 页：章节切换、进入学习、课后测验入口

## 关键文件清单
### 优先会修改的现有文件
- `backend/internal/handler/resource.go`
- `backend/internal/service/ai_client.go`
- `backend/internal/agent/content.go`
- `backend/internal/agent/quiz.go`
- `backend/internal/handler/knowledge.go`
- `backend/internal/repository/knowledge.go`
- `ai-service/app/main.py`
- `ai-service/app/models/schemas.py`
- `frontend/src/app/resources/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/types.ts`

### 高概率新增的文件
- `backend/internal/handler/course.go`
- `backend/internal/repository/resource.go`
- `backend/internal/repository/course.go`
- `backend/internal/agent/courseware.go`
- `ai-service/app/routers/extract.py`
- `ai-service/app/routers/url.py`
- `ai-service/app/services/extractor.py`
- `ai-service/app/services/url_parser.py`
- `frontend/src/app/courses/[id]/page.tsx`

## 执行顺序总结
**推荐实际落地顺序：**
1. Phase 0 资料基座
2. Phase 1 URL 输入
3. Phase 2 章节化课程
4. Phase 3 个性化教学
5. Phase 4 书架与仪表盘
6. Phase 5 单人测验与错题本

这样推进的原因是：它严格围绕一条真实主链路展开，不会先做假展示，也不会过早引入多人/社交复杂度。
