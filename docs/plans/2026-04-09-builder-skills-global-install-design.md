# Builder-Skills 全局安装与 MindFlow 前端重写设计

> 日期：2026-04-09
> 状态：已确认方案

## 目标

将 `https://github.com/kazdenc/builder-skills` 以 **CodeBuddy 可用的全局 skills** 形式安装到当前环境，并优先启用适合 MindFlow 的前端设计/重写工作流，用于重构当前过于简陋的前端界面。

## 已确认决策

1. **安装方式**：全局安装，而不是仅当前项目安装
2. **使用目标**：优先服务于 MindFlow 前端重写
3. **当前阶段重点**：设计类与前端工程类 skills

## 设计原则

### 1. 全局安装，但按主题启用

虽然采用全局安装，但实际使用时优先聚焦以下能力：

- 前端设计方法论
- 设计审查与打磨
- Next.js / React 最佳实践
- 代码审查与前端重构建议

避免一开始就把产品、部署、测试类 workflow 全量混入当前重写流程，降低噪音。

### 2. 先接入，再验证，再用于重写

执行顺序：

1. 安装 builder-skills 到全局 CodeBuddy skill 目录
2. 验证 CodeBuddy 可以识别和调用这些 skills
3. 挑选与 MindFlow 直接相关的 skills 做一次小范围验证
4. 基于验证通过的 skills，重新设计 MindFlow 前端

### 3. 前端重写目标

当前前端问题：

- 首页过于像技术原型，不像产品界面
- 缺少学习产品该有的信息层级
- 视觉语言不统一
- 没有为后续 dashboard / review / knowledge 页面建立共享布局体系

重写目标：

- 建立统一的页面框架和视觉风格
- 让首页更像“AI 学习导师工作台”而不是普通聊天页
- 为后续多页面扩展预留布局和组件骨架

## 推荐接入范围

虽然是全局安装，但第一阶段优先使用下列 skills：

- `frontend-design`
- `design-foundations`
- `audit`
- `critique`
- `polish`
- `normalize`
- `vercel-react-best-practices`
- `code-review`

这些 skills 足以覆盖：

- 设计方向澄清
- 视觉和信息结构重构
- 前端代码质量校验
- Next.js 最佳实践约束

## 与 MindFlow 的结合方式

### 阶段 1：设计重构

- 用设计类 skills 重新定义首页结构
- 调整视觉层级、排版、间距、色彩和交互反馈
- 明确哪些内容属于“导师引导”、哪些属于“学习状态”、哪些属于“后续模块预留区”

### 阶段 2：前端骨架重构

- 重做首页布局
- 抽离统一布局组件
- 为后续页面建立共享页面框架

### 阶段 3：审查与打磨

- 运行审查类 skills 检查可读性、一致性、可扩展性
- 根据结果继续打磨前端

## 风险与约束

### 风险 1：CodeBuddy 与 Claude Code 的 skill 目录机制不完全一致

应对方式：
- 先做最小安装验证
- 以“能否被 ToolSearch / Skill 识别”为准
- 如全局目录机制不同，则调整到 CodeBuddy 支持的位置

### 风险 2：全局 skills 太多带来噪音

应对方式：
- 虽然全局安装，但当前会话只主动使用前端相关 skills
- 不把无关 skills 引入当前重写流程

### 风险 3：过早做视觉细节，影响主链路开发

应对方式：
- 本次前端重写以“页面骨架 + 视觉体系 + 可扩展布局”为目标
- 不在现阶段过度投入复杂动画或低优先级细节

## 成功标准

满足以下条件即视为这轮工作成功：

1. builder-skills 已全局安装完成
2. CodeBuddy 能识别并调用至少一个 builder-skills 相关 skill
3. MindFlow 前端重写方案形成
4. 新首页比当前版本明显更具产品感和结构感
5. 为后续 Dashboard / Review / Knowledge 页面预留统一扩展能力
