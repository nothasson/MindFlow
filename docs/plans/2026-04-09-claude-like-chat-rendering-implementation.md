# Claude-like 会话渲染与界面对齐 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 MindFlow 前端改造成接近 claude.ai 的三态界面，并让 AI 回复支持 Markdown + Mermaid 图码切换渲染。

**Architecture:** 保持现有 `useChat -> /api/chat` 主链路不变，只在前端页面状态、布局组件和消息渲染层做改造。空态显示品牌 + 单输入框，会话态切换到文档流消息区，assistant 消息经 MarkdownRenderer 处理，Mermaid fenced code block 由 MermaidBlock 独立渲染并支持“查看源码 / 查看图”切换。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, react-markdown, remark-gfm, rehype-sanitize, mermaid, Vitest, React Testing Library

---

### Task 1: 为前端补齐测试基础设施

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/vite-env.d.ts`

**Step 1: 添加测试依赖并写出最小脚本**

在 `frontend/package.json` 中新增：
```json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3",
    "jsdom": "^26",
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6"
  }
}
```

**Step 2: 创建 Vitest 配置**

在 `frontend/vitest.config.ts` 中写：
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 3: 创建 setup 文件**

在 `frontend/src/test/setup.ts` 中写：
```ts
import "@testing-library/jest-dom/vitest";
```

**Step 4: 安装依赖并验证测试命令可运行**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend install`
Expected: 安装成功

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test`
Expected: PASS（0 个测试也可通过，命令可运行）

**Step 5: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/test/vite-env.d.ts
git commit -m "test: 为前端添加 Vitest 测试基础设施"
```

---

### Task 2: 修正空态与会话态状态机

**Files:**
- Modify: `frontend/src/hooks/useChat.ts`
- Modify: `frontend/src/app/page.tsx`
- Test: `frontend/src/app/page.test.tsx`

**Step 1: 写失败测试，验证首屏只有一个输入框**

在 `frontend/src/app/page.test.tsx` 中写：
```tsx
import { render, screen } from "@testing-library/react";
import Home from "./page";

vi.mock("@/hooks/useChat", () => ({
  useChat: () => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
  }),
}));

test("empty state renders single input shell", () => {
  render(<Home />);
  expect(screen.getByPlaceholderText("How can I help you today?")).toBeInTheDocument();
  expect(screen.queryByText("思考中...")).not.toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/app/page.test.tsx`
Expected: FAIL（当前状态结构不完全符合测试）

**Step 3: 写最小实现**

- `useChat` 初始消息保持空数组
- `page.tsx` 明确分离空态与会话态
- 空态只渲染品牌区 + 单输入框
- 会话态渲染消息流 + 底部输入框

**Step 4: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/app/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useChat.ts frontend/src/app/page.tsx frontend/src/app/page.test.tsx
git commit -m "feat: 切分首屏空态与会话态"
```

---

### Task 3: 实现 claude.ai 风格侧栏开关

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/SidebarToggle.tsx`
- Test: `frontend/src/components/layout/SidebarToggle.test.tsx`

**Step 1: 写失败测试，验证侧栏按钮可切换显隐**

在 `frontend/src/components/layout/SidebarToggle.test.tsx` 中写：
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarToggle } from "./SidebarToggle";

test("toggle button calls onToggle", async () => {
  const onToggle = vi.fn();
  render(<SidebarToggle open={false} onToggle={onToggle} />);
  await userEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
```

**Step 2: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/layout/SidebarToggle.test.tsx`
Expected: FAIL（组件尚不存在）

**Step 3: 写最小实现**

- 新建 `SidebarToggle.tsx`
- `page.tsx` 中增加 `isSidebarOpen` 状态
- `AppShell.tsx` 支持覆盖式左栏抽屉
- `Sidebar.tsx` 改成 claude.ai 风格结构：New chat / Search / 最近会话 / 底部用户区

**Step 4: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/layout/SidebarToggle.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/SidebarToggle.tsx frontend/src/components/layout/SidebarToggle.test.tsx
git commit -m "feat: 添加 claude 风格侧栏开关"
```

---

### Task 4: 为 Markdown 渲染引入依赖与安全默认值

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/chat/MarkdownRenderer.tsx`
- Test: `frontend/src/components/chat/MarkdownRenderer.test.tsx`

**Step 1: 添加 Markdown 相关依赖**

在 `frontend/package.json` 中新增：
```json
{
  "dependencies": {
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "rehype-sanitize": "^6"
  }
}
```

**Step 2: 写失败测试，验证 assistant Markdown 可渲染标题和列表**

在 `frontend/src/components/chat/MarkdownRenderer.test.tsx` 中写：
```tsx
import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "./MarkdownRenderer";

test("renders markdown heading and list", () => {
  render(<MarkdownRenderer content={"# 标题\n\n- A\n- B"} />);
  expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
  expect(screen.getByText("A")).toBeInTheDocument();
});
```

**Step 3: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MarkdownRenderer.test.tsx`
Expected: FAIL（组件尚不存在）

**Step 4: 写最小实现**

在 `MarkdownRenderer.tsx` 中实现：
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {content}
    </ReactMarkdown>
  );
}
```

**Step 5: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MarkdownRenderer.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/package.json frontend/src/components/chat/MarkdownRenderer.tsx frontend/src/components/chat/MarkdownRenderer.test.tsx
git commit -m "feat: 添加安全的 Markdown 渲染组件"
```

---

### Task 5: 实现 Mermaid 图码切换组件

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/chat/MermaidBlock.tsx`
- Test: `frontend/src/components/chat/MermaidBlock.test.tsx`

**Step 1: 添加 Mermaid 依赖**

在 `frontend/package.json` 中新增：
```json
{
  "dependencies": {
    "mermaid": "^11"
  }
}
```

**Step 2: 写失败测试，验证切换按钮可切换源码视图**

在 `frontend/src/components/chat/MermaidBlock.test.tsx` 中写：
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MermaidBlock } from "./MermaidBlock";

test("toggles between diagram and source", async () => {
  render(<MermaidBlock code={"graph TD; A-->B;"} />);
  await userEvent.click(screen.getByRole("button", { name: "查看源码" }));
  expect(screen.getByText("graph TD; A-->B;")).toBeInTheDocument();
});
```

**Step 3: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MermaidBlock.test.tsx`
Expected: FAIL（组件尚不存在）

**Step 4: 写最小实现**

- 组件内部维护 `showSource` 状态
- 默认展示图
- 点击按钮切换到源码块
- Mermaid 渲染错误时自动显示源码

最小结构：
```tsx
export function MermaidBlock({ code }: { code: string }) {
  const [showSource, setShowSource] = useState(false);
  if (showSource) return <pre>{code}</pre>;
  return (
    <div>
      <button onClick={() => setShowSource(true)}>查看源码</button>
      <div data-testid="mermaid-diagram" />
    </div>
  );
}
```

**Step 5: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MermaidBlock.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/package.json frontend/src/components/chat/MermaidBlock.tsx frontend/src/components/chat/MermaidBlock.test.tsx
git commit -m "feat: 添加 Mermaid 图码切换组件"
```

---

### Task 6: 将 Mermaid 接入 MarkdownRenderer

**Files:**
- Modify: `frontend/src/components/chat/MarkdownRenderer.tsx`
- Modify: `frontend/src/components/chat/MermaidBlock.tsx`
- Test: `frontend/src/components/chat/MarkdownRenderer.test.tsx`

**Step 1: 写失败测试，验证 mermaid fenced code block 被接管**

在 `MarkdownRenderer.test.tsx` 中追加：
```tsx
test("renders mermaid block with toggle UI", () => {
  render(<MarkdownRenderer content={"```mermaid\ngraph TD; A-->B;\n```"} />);
  expect(screen.getByRole("button", { name: "查看源码" })).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MarkdownRenderer.test.tsx`
Expected: FAIL（当前代码块还未被 MermaidBlock 替换）

**Step 3: 写最小实现**

在 `MarkdownRenderer.tsx` 自定义 `code` 渲染器：
```tsx
components={{
  code(props) {
    const { className, children } = props;
    const language = className?.replace("language-", "");
    const code = String(children).trim();
    if (language === "mermaid") {
      return <MermaidBlock code={code} />;
    }
    return <code className={className}>{children}</code>;
  },
}}
```

**Step 4: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MarkdownRenderer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/chat/MarkdownRenderer.tsx frontend/src/components/chat/MermaidBlock.tsx frontend/src/components/chat/MarkdownRenderer.test.tsx
git commit -m "feat: 在 Markdown 渲染中接入 Mermaid 图码切换"
```

---

### Task 7: 将 assistant 消息切换为 MarkdownRenderer

**Files:**
- Modify: `frontend/src/components/chat/MessageBubble.tsx`
- Modify: `frontend/src/components/chat/MessageList.tsx`
- Test: `frontend/src/components/chat/MessageBubble.test.tsx`

**Step 1: 写失败测试，验证 assistant 消息走 Markdown，user 消息仍是纯文本**

在 `frontend/src/components/chat/MessageBubble.test.tsx` 中写：
```tsx
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./MessageBubble";

test("assistant renders markdown", () => {
  render(<MessageBubble message={{ role: "assistant", content: "# 标题" }} />);
  expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
});

test("user renders plain text", () => {
  render(<MessageBubble message={{ role: "user", content: "# 不是标题" }} />);
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  expect(screen.getByText("# 不是标题")).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MessageBubble.test.tsx`
Expected: FAIL

**Step 3: 写最小实现**

- assistant 分支使用 `<MarkdownRenderer content={message.content} />`
- user 分支继续 `<p className="whitespace-pre-wrap">{message.content}</p>`
- 保持现有消息列表滚动逻辑不变

**Step 4: 重新运行测试**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test -- src/components/chat/MessageBubble.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/chat/MessageBubble.tsx frontend/src/components/chat/MessageList.tsx frontend/src/components/chat/MessageBubble.test.tsx
git commit -m "feat: 让 AI 回复支持 Markdown 渲染"
```

---

### Task 8: 收口样式并验证完整链路

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/chat/ChatInput.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `README.md`

**Step 1: 收口样式，对齐 claude.ai 三态体验**

确保：
- 首屏只有品牌区 + 单输入框
- 左栏默认关闭，可手动打开
- 会话态输入框固定在底部
- assistant Markdown 样式是文档流，不是聊天气泡堆叠

**Step 2: 更新 README 更新历史**

新增一条：
```md
| 2026-04-09 | feat | AI 回复支持 Markdown + Mermaid 图码切换，并对齐 claude.ai 三态界面 |
```

**Step 3: 运行完整测试与验证**

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend test`
Expected: PASS

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend run build`
Expected: PASS

Run: `npm --prefix /Users/hasson/Codes/MindFlow/frontend run lint`
Expected: PASS

Run: `docker-compose -f /Users/hasson/Codes/MindFlow/docker-compose.yml restart frontend`
Expected: frontend 容器重启成功

Run: `curl -s http://localhost:3000 | sed -n 's:.*<title>\(.*\)</title>.*:\1:p' | head -1`
Expected: `MindFlow`

**Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/chat/ChatInput.tsx frontend/src/app/layout.tsx README.md
git commit -m "feat: 完成 claude 风格会话渲染与 Mermaid 支持"
```
