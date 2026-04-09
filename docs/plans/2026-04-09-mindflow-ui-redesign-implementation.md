# MindFlow 前端重构（B+C 融合）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将首页重构为“任务导向的学习工作台”，实现双栏结构 + 轻量概览，并去除刻意营销文案。

**Architecture:** 保持现有 `useChat -> /api/chat` 主链路不变，仅在前端布局层和文案层重构。左栏承载任务/状态/快捷操作，右栏承载导航+对话+输入。视觉统一到冷色蓝灰体系，减少装饰性渐变、重阴影和“即将上线”提示。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Docker Compose

---

### Task 1: 建立重构验收基线

**Files:**
- Modify: `docs/plans/2026-04-09-builder-skills-install-and-frontend-redesign.md`
- Modify: `docs/plans/2026-04-09-mindflow-ui-redesign-design.md`

**Step 1: 写验收清单（页面与文案）**

在设计文档中明确首版验收条件：
- 首屏无“AI Native”口号块
- 无“即将上线”文案
- 左栏包含“今日任务/学习状态/快捷操作”
- 主色调为冷色蓝灰

**Step 2: 校对计划和设计一致性**

Run: `git -C /Users/hasson/Codes/MindFlow diff -- docs/plans/2026-04-09-builder-skills-install-and-frontend-redesign.md docs/plans/2026-04-09-mindflow-ui-redesign-design.md`
Expected: 计划与设计都体现 B+C 融合（双栏 + 轻量概览）

---

### Task 2: 重构首页头部与主容器文案

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: 删除营销文案与移动端“后续版本”提示**

移除：
- `AI Native 自适应学习平台` 标签
- 长段口号式描述
- 移动端“后续版本中出现”提示块

**Step 2: 改为功能直述头部**

保留简洁标题和一句功能型说明，例如“开始对话，系统会记录你的学习状态并安排下一步”。

**Step 3: 本地构建验证**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend run build`
Expected: PASS

---

### Task 3: 左栏改为三块任务面板

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: 重写左栏信息架构**

将现有“温和引导/苏格拉底原则”改成三块：
1) 今日任务
2) 学习状态（掌握度/待复习/连续学习）
3) 快捷操作（继续上次/新建会话/进入复习）

**Step 2: 文案全部改为动作导向**

示例：
- “继续上次会话”
- “查看今日复习队列”
- “开始一个新问题”

**Step 3: 本地构建验证**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend run build`
Expected: PASS

---

### Task 4: 导航与视觉系统统一为冷色蓝灰

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/components/chat/MessageList.tsx`
- Modify: `frontend/src/components/chat/MessageBubble.tsx`
- Modify: `frontend/src/components/chat/ChatInput.tsx`

**Step 1: 移除装饰性渐变和过强阴影**

- `AppShell` 背景改为中性底色
- 减少玻璃态/大阴影效果

**Step 2: 替换暖色体系为冷色蓝灰**

- 将 amber/rose 主导色替换为 slate/blue-gray 主导色
- 错误状态保留红色语义

**Step 3: 删除“即将上线”文案**

`TopNav` 保留禁用态样式，但不显示“即将上线”字样。

**Step 4: 本地构建验证**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend run build`
Expected: PASS

---

### Task 5: 更新 README 定位文案与更新历史

**Files:**
- Modify: `README.md`

**Step 1: 首页定位改为结果导向描述**

弱化“AI Native”口号，突出可验证能力：诊断、规划、复习、连续记忆。

**Step 2: 更新“更新历史”**

新增一条记录本次前端重构（B+C 融合）和文案降噪。

**Step 3: 文档检查**

Run: `git -C /Users/hasson/Codes/MindFlow diff -- README.md`
Expected: 文案克制、无情绪化营销表达

---

### Task 6: 运行时验证（容器）

**Files:**
- Modify: 无（验证任务）

**Step 1: 重启前端容器**

Run: `docker-compose -f /Users/hasson/Codes/MindFlow/docker-compose.yml restart frontend`
Expected: frontend 容器重启成功

**Step 2: 检查标题可访问**

Run: `curl -s http://localhost:3000 | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | head -1`
Expected: `MindFlow`

**Step 3: 手动验收页面结构**

确认：
- 左栏三块信息存在
- 右栏对话可正常发送/接收
- 页面主色为冷色蓝灰
- 无“AI Native”首屏口号与“即将上线”文本

---

### Task 7: 代码质量与提交准备

**Files:**
- Modify: 以上所有改动文件

**Step 1: 查看改动范围**

Run: `git -C /Users/hasson/Codes/MindFlow status --short`
Expected: 仅包含本轮 UI 与文案相关文件

**Step 2: 复查差异**

Run: `git -C /Users/hasson/Codes/MindFlow diff`
Expected: 不包含接口协议、后端逻辑和无关重构

**Step 3: 等待用户确认是否提交**

说明：按当前会话约束，提交与推送需用户明确指令后执行。
