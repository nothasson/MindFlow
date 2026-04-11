# MindFlow FSRS 算法 / 错题变式题 / AI+复习 深度调研报告

> **任务**：调研 FSRS 算法、Anki 功能设计、错题变式题系统、遗忘曲线+AI 结合的最新进展，为 MindFlow 复习系统升级提供方案
> **执行时间**：2026年4月10日

---

## 一、FSRS 算法深度分析

### 1.1 概述

FSRS（Free Spaced Repetition Scheduler）由叶峻峣开发，2023年10月集成到 Anki，最新版本 **FSRS-6**。核心创新：基于机器学习的两维记忆模型，用 21 个可优化权重参数替代 SM-2 的固定规则。

### 1.2 FSRS vs SM-2 详细对比

| 维度 | SM-2 (MindFlow 现用) | FSRS |
|------|---------------------|------|
| 年份 | 1987 | 2022 |
| 状态变量 | 1个（EasinessFactor） | 2个（Stability + Difficulty） |
| 参数数量 | 0个可优化（全部硬编码） | 21个可优化权重（w0-w20） |
| 个性化 | 无 | 根据用户复习历史训练参数 |
| 遗忘模型 | 无显式模型 | 幂函数遗忘曲线 R = (1 + FACTOR×t/S)^DECAY |
| 目标保留率 | 固定（~90%） | 可配置（85%/90%/95%等） |
| 训练数据 | 不需要 | 训练自 7 亿条真实 Anki 复习记录 |
| 准确率 | 基线 | 在 97.4% 的数据集上优于 SM-2 |
| 复习效率 | 基线 | **减少 20-30% 日复习量** |

### 1.3 核心工作原理

**三大核心变量**：
- **Stability (S)**：Retrievability 从 100% 降到 90% 所需天数
- **Difficulty (D)**：卡片固有难度（1-10）
- **Retrievability (R)**：当前可检索概率

**21 个权重参数分工**：
- w0-w3：初始稳定性（Again/Hard/Good/Easy 四种首次评分）
- w2-w5：难度计算
- w8-w11：失败后稳定性
- w9：成功后稳定性增长缩放
- w15-w16：Hard/Easy 评分乘数
- w17-w19：短期记忆（同日复习）
- w20：遗忘曲线个性化

### 1.4 Go 语言官方实现

**`github.com/open-spaced-repetition/go-fsrs`**
- 版本：v4.0.0（2026年3月3日）
- 许可证：MIT
- 安装：`go get -u github.com/open-spaced-repetition/go-fsrs/v4@latest`

核心 API：
```go
params := fsrs.DefaultParam()
params.RequestRetention = 0.9
scheduler := fsrs.NewFSRS(params)
card := fsrs.NewCard()
info := scheduler.Next(card, time.Now(), fsrs.Good)
r := scheduler.GetRetrievability(card, time.Now())
```

### 1.5 MindFlow 迁移方案

**评分映射**（SM-2 的 0-5 → FSRS 的 4 级）：
- 0, 1, 2 → Again (1)
- 3 → Hard (2)
- 4 → Good (3)
- 5 → Easy (4)

**数据库 migration**：
```sql
ALTER TABLE knowledge_mastery
  ADD COLUMN stability DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN difficulty DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN card_state INTEGER DEFAULT 0,
  ADD COLUMN lapses INTEGER DEFAULT 0,
  ADD COLUMN reps INTEGER DEFAULT 0,
  ADD COLUMN scheduled_days INTEGER DEFAULT 0,
  ADD COLUMN elapsed_days INTEGER DEFAULT 0;
```

**优先级：P0**

---

## 二、Anki 功能设计与不足

### Anki 的核心不足 = MindFlow 的机会

| Anki 的问题 | MindFlow 的机会 |
|------------|----------------|
| 学习曲线极陡 | 自然语言交互，零学习成本 |
| 需要手动制卡（耗时） | AI 自动从资料提取，零制卡成本 |
| 纯记忆，不理解 | 苏格拉底对话填补理解空白 |
| 无 AI 教学 | Diagnostic Agent 诊断错因 |
| 无知识图谱 | 知识图谱展示全局关系 |
| 无自适应出题 | Quiz Agent 动态生成题目 |
| 界面老旧 | 现代 UI 体验 |

**关键洞察**：Anki 的 FSRS 算法是最好的，但 UX/内容生成/教学互动极差。MindFlow 应该**用 FSRS 算法 + 自己的一切其他能力**。

---

## 三、错题变式题系统

### 3.1 六种变式题类型

| 类型 | 触发条件 | 生成规则 | 难度调整 |
|------|---------|---------|---------|
| 参数变换 | 任何错误 | 替换数值，保持结构 | 同等 |
| 情境变换 | 概念错误 | 换生活背景，测本质理解 | 同等或稍高 |
| 角度变换 | 方法错误 | 变换条件/结论 | 稍高 |
| 反向出题 | 概念错误 | 交换已知和求解 | 稍高 |
| 简化变式 | 计算错误 | 降低复杂度，练基本功 | 降低 |
| 综合变式 | 概念已掌握 | 融合多个关联概念 | 提高 |

### 3.2 实现方案

**与 Diagnostic Agent 联动**：诊断结果直接传递给变式题生成
**与 FSRS 联动**：变式题复习纳入间隔重复调度
**与知识图谱联动**：找关联概念生成跨概念复合变式题

**数据库支持**：
```sql
CREATE TABLE IF NOT EXISTS variant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_question_id UUID,
  concept_id TEXT NOT NULL,
  variant_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 3,
  target_concepts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**优先级：P0**

---

## 四、遗忘曲线 + AI 结合的最新进展

### LECTOR 算法（2025）
- 将 LLM 语义分析与间隔重复结合
- 相似概念安排交错复习，避免混淆
- 成功率 90.2%（vs 基线 88.4%）

### FSRS + 知识图谱创新融合方案

**核心 idea**：FSRS 决定"什么时候复习"，知识图谱决定"复习什么"。

1. 每个知识点有独立的 FSRS Card 状态
2. 复习时检查知识图谱中该概念的前置节点
3. 前置节点也弱则优先补前置知识
4. 易混淆概念安排在同一 session 交错出现
5. 变式题自动关联 FSRS 评分

---

## 五、优先级汇总

| 优化项 | 优先级 | 实现难度 | 预期效果 |
|--------|--------|---------|---------|
| FSRS 算法迁移（go-fsrs v4） | P0 | 低 | 复习效率提升 20-30% |
| 错题变式题系统 | P0 | 中 | 核心差异化功能 |
| FSRS 评分 UI 改造（4按钮） | P0 | 低 | 配合 FSRS 迁移 |
| 知识图谱驱动智能复习排序 | P1 | 中 | 解决概念混淆 |
| FSRS 参数自优化 | P2 | 高 | 长期个性化 |
| 易混淆概念交错复习 | P2 | 中 | 减少语义混淆错误 |
