import { test, expect } from "@playwright/test";

/**
 * 对话流程 E2E 测试
 *
 * 测试苏格拉底式对话的核心流程：
 * 1. 打开首页，验证输入框可见
 * 2. 输入学习问题，发送消息
 * 3. 等待 AI 流式回复完成
 * 4. 验证回复内容有效
 * 5. 刷新页面后验证会话持久化
 */

test.describe("对话流程", () => {
  test("发送消息并收到 AI 回复", async ({ page }) => {
    // 1. 打开首页
    await page.goto("/");

    // 验证页面加载完成：MindFlow 标题可见
    await expect(page.locator("h1", { hasText: "MindFlow" })).toBeVisible();

    // 2. 找到输入框并输入消息
    const textarea = page.locator("textarea[placeholder='输入你想学的内容...']");
    await expect(textarea).toBeVisible();
    await textarea.fill("什么是特征值？");

    // 3. 点击发送按钮
    const sendButton = page.locator("form button[type='submit']");
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // 4. 验证用户消息已显示
    await expect(page.locator("text=什么是特征值？")).toBeVisible({ timeout: 5_000 });

    // 5. 等待 AI 回复出现（流式响应可能需要较长时间）
    // AI 回复标识：带有 "M" 头像的 assistant 气泡
    // 等待"思考中..."消失或 assistant 内容出现
    const assistantBubble = page.locator(".flex.gap-3").filter({
      has: page.locator("div", { hasText: /^M$/ }),
    }).last();

    // 等待 AI 回复内容出现（非"思考中..."）
    await expect(async () => {
      const text = await assistantBubble.textContent();
      // 确保回复不为空且不只是"思考中..."
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(5);
      expect(text).not.toBe("M思考中...");
    }).toPass({ timeout: 45_000 });

    // 6. 验证回复包含中文字符（苏格拉底式教学应使用中文）
    const replyText = await assistantBubble.textContent();
    expect(replyText).toMatch(/[\u4e00-\u9fff]/);

    // 7. 记录当前会话 ID（通过 URL 或侧边栏判断）
    const currentUrl = page.url();

    // 8. 刷新页面，验证会话持久化
    await page.reload();

    // 等待页面重新加载完成
    await page.waitForLoadState("networkidle");

    // 如果 URL 中有 conversation 参数，说明会话已持久化
    // 否则检查侧边栏中是否有历史会话
    // 侧边栏中应能看到之前的会话记录
    // 注意：会话列表是通过 API 加载的，需要等待
    await page.waitForTimeout(2_000);

    // 验证方式 1：检查消息列表是否仍然显示
    // 验证方式 2：检查侧边栏有会话记录
    // 这里两种都尝试，有一种通过即可
    const hasMessages = await page.locator("text=什么是特征值？").isVisible().catch(() => false);
    const hasSidebarConversation = await page
      .locator("aside")
      .locator("button, a")
      .filter({ hasText: /特征值|新对话/ })
      .first()
      .isVisible()
      .catch(() => false);

    // 至少一种持久化方式应该生效
    expect(hasMessages || hasSidebarConversation).toBeTruthy();
  });

  test("空消息不能发送", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1", { hasText: "MindFlow" })).toBeVisible();

    // 发送按钮应该是禁用状态
    const sendButton = page.locator("form button[type='submit']");
    await expect(sendButton).toBeDisabled();

    // 输入空格后仍应禁用
    const textarea = page.locator("textarea[placeholder='输入你想学的内容...']");
    await textarea.fill("   ");
    await expect(sendButton).toBeDisabled();
  });

  test("连续多轮对话", async ({ page }) => {
    await page.goto("/");

    const textarea = page.locator("textarea[placeholder='输入你想学的内容...']");
    const sendButton = page.locator("form button[type='submit']");

    // 第一轮
    await textarea.fill("什么是矩阵？");
    await sendButton.click();

    // 等待第一轮 AI 回复
    await expect(async () => {
      const bubbles = page.locator(".flex.gap-3").filter({
        has: page.locator("div", { hasText: /^M$/ }),
      });
      const count = await bubbles.count();
      expect(count).toBeGreaterThanOrEqual(1);
      const lastText = await bubbles.last().textContent();
      expect(lastText!.length).toBeGreaterThan(5);
    }).toPass({ timeout: 45_000 });

    // 第二轮
    await textarea.fill("能给我举个例子吗？");
    await sendButton.click();

    // 等待第二轮 AI 回复（应该有 2 个 assistant 气泡）
    await expect(async () => {
      const bubbles = page.locator(".flex.gap-3").filter({
        has: page.locator("div", { hasText: /^M$/ }),
      });
      const count = await bubbles.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 45_000 });
  });
});
