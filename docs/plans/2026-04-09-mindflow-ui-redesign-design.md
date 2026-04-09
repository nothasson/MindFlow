# MindFlow 前端重构设计（B+C 融合）

> 日期：2026-04-09
> 状态：已确认（用户指令："开搞"）

## 1. 目标

在不改变现有聊天主链路的前提下，把首页从“文案驱动的演示页”重构为“任务驱动的学习工作台”。

- 保留双栏工作台（方案 B）
- 引入轻量数据概览（方案 C）
- 文案改为功能直述
- 视觉切换为冷色蓝灰，降低装饰感

## 2. 信息架构

### 2.1 页面结构

- 左栏（学习面板）
  1) 今日任务
  2) 学习状态（掌握度 / 待复习 / 连续学习）
  3) 快捷操作（继续上次 / 新建会话 / 进入复习）
- 右栏（主工作区）
  - 顶部导航（仅保留可用入口，不显示“即将上线”）
  - 对话消息区
  - 输入区

### 2.2 改动边界

- 不改接口协议：`POST /api/chat` 请求与响应结构保持不变
- 不改状态模型：继续使用 `useChat`
- 不引入新状态管理库

## 3. 视觉与交互策略

### 3.1 视觉系统

- 主色：冷色蓝灰（slate/blue-gray）
- 背景：纯色或低对比中性色，移除暖色渐变背景
- 阴影：减少玻璃态和大阴影，改为轻边框与轻阴影
- 状态色：仅用于错误和主按钮，避免大面积强调色

### 3.2 文案策略

- 去掉品牌口号和过度解释
- 保留动作导向文案："继续学习"、"进入复习"、"思考中..."
- 去掉“后续版本/即将上线”提示语

## 4. 数据与渲染流

1. 页面加载：`useChat` 初始化消息状态
2. 用户发送：`ChatInput` 调 `onSend`，进入 loading
3. 响应返回：`MessageList` 渲染 assistant 消息
4. 左栏卡片：首版使用静态占位数据结构，后续接真实学习状态接口

## 5. 错误处理

- 保留当前错误提示容器（对话区内展示）
- 错误文案中立化，避免情绪化提示
- 快捷操作在无数据时显示可点击但可解释状态（不阻断主链路）

## 6. 验证策略

- 前端构建验证：`frontend npm run build`
- 本地访问验证：首页可正常打开，对话发送与返回正常
- 样式验收标准：
  - 首屏无“AI Native”口号位
  - 无“即将上线”文案
  - 主体颜色为冷色蓝灰
  - 左栏包含三类信息块（任务/状态/快捷操作）

## 7. 受影响文件

- `frontend/src/app/page.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/TopNav.tsx`
- `frontend/src/components/chat/MessageList.tsx`
- `frontend/src/components/chat/ChatInput.tsx`
- `frontend/src/components/chat/MessageBubble.tsx`
- `README.md`

## 8. 与现有计划的对齐

同步更新实施计划文件：
- `docs/plans/2026-04-09-builder-skills-install-and-frontend-redesign.md`

把原本偏“温和陪伴”的表达，统一替换为“任务导向 + 轻量概览 + 冷色蓝灰”执行标准。