# Builder-Skills 安装与 MindFlow 前端重写实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 全局安装 builder-skills 到 CodeBuddy 可用目录，并基于其设计方法将 MindFlow 首页重构为“任务导向的学习工作台”（方案 B+C 融合：双栏工作台 + 轻量概览）。

**Architecture:** 先完成 builder-skills 的全局安装与识别验证，再用前端相关 skills 产出新的页面结构和视觉方向，最后在现有 Next.js App Router 前端上以最小改动重构首页、布局与共享组件。保持当前聊天主链路可用，不引入额外后端复杂度。

**Tech Stack:** CodeBuddy Skills, Git, Next.js 16, React 19, TypeScript, Tailwind CSS 4, Docker Compose

---

### Task 1: 安装 builder-skills 到全局 skill 目录

**Files:**
- Create/Modify: CodeBuddy 全局 skills 目录中的 builder-skills 相关文件
- Reference: `docs/plans/2026-04-09-builder-skills-global-install-design.md`

**Step 1: 克隆或拉取 builder-skills 仓库到临时目录**

Run:
```bash
git clone https://github.com/kazdenc/builder-skills /tmp/builder-skills
```

Expected: 仓库下载成功，存在 `.claude/skills/` 目录。

**Step 2: 检查 skill 目录结构**

Run:
```bash
ls -R /tmp/builder-skills/.claude/skills | head -80
```

Expected: 能看到 design / dev / product 等 skill 目录结构。

**Step 3: 复制到 CodeBuddy 全局 skills 目录**

Run:
```bash
cp -R /tmp/builder-skills/.claude/skills/* ~/.codebuddy/skills/
```

Expected: 全局 skills 目录新增 builder-skills 提供的 skills。

**Step 4: 验证安装结果**

Run:
```bash
ls ~/.codebuddy/skills
```

Expected: 能看到 builder-skills 相关目录或 skill 文件。

**Step 5: Commit**

不提交代码仓库；这是本地全局环境变更，记录到 README 更新历史即可。

---

### Task 2: 验证 CodeBuddy 可识别 builder-skills

**Files:**
- Modify: `README.md`（更新历史）

**Step 1: 用 ToolSearch 或 Skill 列出可用 skills**

Run:
```text
使用 CodeBuddy 的 Skill / ToolSearch 能力查询 frontend-design、audit、critique 等 skill 是否可见
```

Expected: 至少能识别 1 个 builder-skills 中的设计类 skill。

**Step 2: 记录验证结果**

把验证通过的 skill 名称记到工作记录中，后续只使用这些技能。

**Step 3: 更新 README 更新历史**

在 `README.md` 的“更新历史”中新增一条：

```markdown
| 2026-04-09 | chore | 全局安装 builder-skills，并验证 CodeBuddy 可识别前端设计类 skills |
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "chore: 记录 builder-skills 全局安装和识别验证"
git push origin main
```

---

### Task 3: 用 builder-skills 产出 MindFlow 前端设计重写 brief

**Files:**
- Create: `docs/plans/2026-04-09-mindflow-frontend-redesign-brief.md`
- Reference: `frontend/src/app/page.tsx`
- Reference: `frontend/src/app/layout.tsx`

**Step 1: 调用设计类 skills 审视当前首页**

Run:
```text
使用 frontend-design / critique / audit（以实际识别到的 skill 为准）分析当前首页的层级、留白、版式、产品感问题
```

Expected: 得到结构、视觉、交互三个维度的改进建议。

**Step 2: 写重写 brief**

在 `docs/plans/2026-04-09-mindflow-frontend-redesign-brief.md` 中写明：
- 页面定位：任务导向学习工作台（弱化口号，强调可执行任务）
- 页面结构：左侧学习面板（今日任务/学习状态/快捷操作）+ 右侧主对话区
- 视觉语言：冷色蓝灰、低装饰、信息层级清晰
- 后续扩展位：dashboard / review / knowledge 的统一导航承载位（不显示“即将上线”字样）

**Step 3: Commit**

```bash
git add docs/plans/2026-04-09-mindflow-frontend-redesign-brief.md
git commit -m "docs: 添加 MindFlow 前端重写 brief"
git push origin main
```

---

### Task 4: 为前端重写建立共享布局骨架

**Files:**
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/layout.tsx:1-34`
- Modify: `frontend/src/app/page.tsx:1-999`

**Step 1: Write the failing test / 明确失败标准**

由于当前前端无测试框架，本任务先用构建验证作为最小门槛：
- 目标 UI 必须支持共享外壳布局
- 首页必须不再只是单栏聊天页

**Step 2: 实现最小共享布局**

创建 `AppShell.tsx`：
```tsx
interface AppShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-4">
        <aside className="hidden w-80 shrink-0 lg:block">{sidebar}</aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
```

创建 `Sidebar.tsx`：
```tsx
export function Sidebar() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-sm text-slate-300">今日学习目标</div>
      <h2 className="mt-3 text-2xl font-semibold">MindFlow 导师台</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        这里后续承载学习目标、知识图谱、复习提醒等内容。
      </p>
    </div>
  );
}
```

**Step 3: Run build to verify**

Run:
```bash
cd frontend && npm run build
```

Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/components/layout frontend/src/app/layout.tsx frontend/src/app/page.tsx
git commit -m "feat: 建立 MindFlow 前端共享布局骨架"
git push origin main
```

---

### Task 5: 重写首页视觉与信息结构

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/chat/MessageList.tsx`
- Modify: `frontend/src/components/chat/MessageBubble.tsx`
- Modify: `frontend/src/components/chat/ChatInput.tsx`

**Step 1: 先定义首页结构**

首页改为（B+C 融合）：
- 左栏：今日任务 + 学习状态（掌握度/待复习/连续学习）+ 快捷操作
- 右栏顶部：简洁导航（仅显示可用项，不显示“即将上线”）
- 右栏中部：主对话区
- 右栏底部：输入区固定，保持当前聊天主链路不变

**Step 2: 最小实现新页面**

将现有界面调整为冷色蓝灰中性色工作台风格，去掉过度营销文案与装饰性提示，提升任务可执行性与信息密度。

关键约束：
- 保留 `useChat` 主链路
- 不改 API 数据结构
- 不引入额外状态管理库

**Step 3: Run build to verify**

Run:
```bash
cd frontend && npm run build
```

Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/chat/
git commit -m "feat: 重写 MindFlow 首页视觉和信息结构"
git push origin main
```

---

### Task 6: 为后续页面预留导航入口

**Files:**
- Create: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: 创建最小导航组件**

```tsx
const items = [
  { label: "对话", href: "/", active: true },
  { label: "知识图谱", href: "#", disabled: true },
  { label: "复习计划", href: "#", disabled: true },
  { label: "学习进度", href: "#", disabled: true },
];
```

做一个只承载视觉结构的导航，不提前实现页面逻辑。

**Step 2: Run build to verify**

Run:
```bash
cd frontend && npm run build
```

Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/layout/TopNav.tsx frontend/src/app/page.tsx
git commit -m "feat: 为后续学习模块预留导航入口"
git push origin main
```

---

### Task 7: 审查前端重写结果并修正细节

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/layout/*.tsx`
- Modify: `frontend/src/components/chat/*.tsx`

**Step 1: 调用 builder-skills 审查类 skills**

Run:
```text
使用 audit / critique / polish（以实际可用为准）审查新首页
```

重点检查：
- 排版是否有层级
- 首页是否像学习产品，而不是普通聊天窗口
- 颜色、阴影、间距是否统一
- 输入区与消息区的视觉关系是否合理

**Step 2: 只做最小修正**

根据审查结果做细节调整，不进行大规模返工。

**Step 3: Run build to verify**

Run:
```bash
cd frontend && npm run build
```

Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/layout frontend/src/components/chat
git commit -m "refactor: 根据 builder-skills 审查结果打磨前端界面"
git push origin main
```

---

### Task 8: Docker 验证和 README 更新

**Files:**
- Modify: `README.md`

**Step 1: 重启前端服务**

Run:
```bash
cd /Users/hasson/Codes/MindFlow && docker-compose restart frontend
```

Expected: 前端容器正常启动。

**Step 2: 验证页面可访问**

Run:
```bash
curl -s http://localhost:3000 | grep -o "<title>[^<]*</title>" | head -1
```

Expected: 输出 `<title>MindFlow</title>`。

**Step 3: 更新 README 更新历史**

新增：
```markdown
| 2026-04-09 | feat | 全局接入 builder-skills，并基于其设计流程重写 MindFlow 首页骨架 |
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: 记录 builder-skills 接入和前端重写里程碑"
git push origin main
```
