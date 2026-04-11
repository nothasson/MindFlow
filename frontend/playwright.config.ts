import { defineConfig, devices } from "@playwright/test";

/**
 * MindFlow E2E 测试配置
 *
 * 前置条件：本地服务已启动
 * - 前端：http://localhost:3000
 * - 后端：http://localhost:8080
 */
export default defineConfig({
  testDir: "./e2e",
  /* 每个测试的最大超时时间（LLM 响应可能较慢） */
  timeout: 60_000,
  /* 断言超时 */
  expect: {
    timeout: 30_000,
  },
  /* 并行执行 */
  fullyParallel: false,
  /* CI 环境下失败不重试 */
  retries: process.env.CI ? 1 : 0,
  /* 并发 worker 数 */
  workers: 1,
  /* 测试报告 */
  reporter: "html",
  /* 共享配置 */
  use: {
    baseURL: "http://localhost:3000",
    /* 操作超时 */
    actionTimeout: 15_000,
    /* 截图：仅失败时保留 */
    screenshot: "only-on-failure",
    /* 录屏：仅失败时保留 */
    video: "retain-on-failure",
    /* Trace：仅首次重试时保留 */
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
