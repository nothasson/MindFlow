# Claude-like 会话渲染与界面对齐设计

> 日期：2026-04-09
> 状态：已确认

## 1. 目标

把 MindFlow 前端调整为更接近 claude.ai 的三态体验，并让 AI 回复支持 Markdown + Mermaid 渲染。

本轮目标包括：
- 首屏只显示品牌区与单输入框
- 左侧栏改为可展开/关闭的 claude.ai 风格抽屉
- 会话页改为文档流阅读体验
- 仅 AI 回复支持 Markdown 渲染
- Mermaid 代码块默认渲染为图，并支持“查看源码 / 查看图”切换

## 2. 设计边界

- 不修改 `/api/chat` 的请求与响应协议
- 不改变 `useChat` 的主调用链路
- 用户消息保持纯文本渲染
- 仅 assistant 消息启用 Markdown + Mermaid 渲染
- Mermaid 渲染失败时必须安全回退到源码展示

## 3. 页面状态设计

### 3.1 首屏空态

对齐 claude.ai 首屏：
- 页面主体只有品牌标题与一个输入框
- 不默认显示消息
- 不默认展开左侧栏
- 输入框是唯一视觉焦点

### 3.2 左栏展开态

点击左上角侧栏按钮后显示抽屉式左栏，包含：
- New chat
- Search / 常用入口
- 最近会话列表
- 底部用户信息区

首版采用前端本地状态控制显隐，先不接真实历史会话接口。

### 3.3 已进入会话态

用户发送第一条消息后进入会话页：
- 顶部只保留轻量会话标题区
- 中间是文档流消息区
- 底部是固定输入框
- 页面排版接近 claude.ai 的阅读体验，而不是传统聊天气泡堆叠

## 4. 消息渲染设计

### 4.1 用户消息

- 保持纯文本
- 不做 Markdown 渲染
- 不支持 Mermaid 解析

### 4.2 AI 回复

AI 回复使用 Markdown 渲染，支持：
- 标题、段落、列表、引用
- 行内代码、代码块
- 表格
- 链接
- Mermaid fenced code block（```mermaid）

### 4.3 Mermaid 规则

- 检测到 ```mermaid``` 代码块时默认先展示图
- 每个 Mermaid 块独立提供“查看源码 / 查看图”切换
- 如果 Mermaid 渲染失败，则回退为源码块，不影响整条消息渲染
- 用户能够复制 Mermaid 源码

## 5. 交互规则

- 首屏默认只显示输入框
- 左上角保留侧栏开关按钮
- 左栏采用覆盖式抽屉，更接近 claude.ai 且更利于移动端适配
- 用户发送第一条消息后自动切换到会话态
- Mermaid 图码切换只作用于当前块，不影响其他内容

## 6. 安全策略

- Markdown 不允许原始 HTML 直接注入页面
- Mermaid 只从 fenced code block 中提取
- 外链添加安全属性
- Mermaid 渲染错误必须局部兜底，不能导致页面整体失败

## 7. 受影响文件

- `frontend/src/app/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/hooks/useChat.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/chat/MessageList.tsx`
- `frontend/src/components/chat/MessageBubble.tsx`
- `frontend/src/components/chat/ChatInput.tsx`
- `frontend/package.json`

预计新增：
- `frontend/src/components/chat/MarkdownRenderer.tsx`
- `frontend/src/components/chat/MermaidBlock.tsx`
- `frontend/src/components/layout/SidebarToggle.tsx`

## 8. 验收标准

完成后必须满足：
1. 首屏只有品牌区与单输入框
2. 左栏可展开/关闭
3. 首次发送后进入会话页
4. AI 回复支持 Markdown 渲染
5. ```mermaid``` 代码块默认显示图，并支持源码切换
6. Mermaid 渲染失败时回退源码
7. `npm run build` 通过
8. `npm run lint` 通过
9. 前端容器重启后页面可访问

## 9. 实施顺序

1. 先改页面状态机（首屏 / 左栏 / 会话态）
2. 再对齐 claude.ai 布局与间距
3. 接入 Markdown 渲染
4. 接入 Mermaid 图码切换
5. 最后做 build / lint / docker 验证
