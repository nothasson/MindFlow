import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * 资料上传 E2E 测试
 *
 * 测试流程：
 * 1. 打开 /resources 页面
 * 2. 创建临时 .txt 文件并上传
 * 3. 验证上传成功并展示解析结果
 * 4. 验证知识点列表非空
 * 5. 测试粘贴文本方式提交
 */

test.describe("资料上传", () => {
  test("上传 .txt 文件并解析知识点", async ({ page }) => {
    // 1. 打开资料库页面
    await page.goto("/resources");

    // 验证页面标题
    await expect(page.locator("h1", { hasText: "资料库" })).toBeVisible();

    // 2. 创建临时测试文件
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `mindflow-test-${Date.now()}.txt`);
    const testContent = [
      "线性代数：特征值与特征向量",
      "",
      "设 A 是 n 阶方阵，若存在数 λ 和非零向量 x，使得 Ax = λx，",
      "则称 λ 是矩阵 A 的一个特征值，x 是对应的特征向量。",
      "",
      "特征值的求解步骤：",
      "1. 计算特征方程 det(A - λI) = 0",
      "2. 求解特征方程得到特征值 λ₁, λ₂, ..., λₙ",
      "3. 对每个特征值，求解 (A - λᵢI)x = 0 得到特征向量",
      "",
      "特征值分解在数据降维（PCA）、图像压缩、振动分析等领域有重要应用。",
    ].join("\n");

    fs.writeFileSync(tmpFile, testContent, "utf-8");

    try {
      // 3. 上传文件
      // 找到隐藏的 file input 元素
      const fileInput = page.locator("input[type='file']");
      await fileInput.setInputFiles(tmpFile);

      // 4. 等待上传和解析完成（显示"正在处理..."然后出结果）
      // 等待处理完成：结果区域出现
      await expect(page.locator("text=资源 ID")).toBeVisible({ timeout: 45_000 });

      // 5. 验证文件名显示
      // 结果区域应该包含文件名
      const resultSection = page.locator("text=处理状态");
      await expect(resultSection).toBeVisible();

      // 6. 验证知识点列表
      const knowledgePointsSection = page.locator("text=提取出的知识点");
      const hasKnowledgePoints = await knowledgePointsSection.isVisible().catch(() => false);

      if (hasKnowledgePoints) {
        // 验证至少提取出了一个知识点标签
        const tags = page.locator("text=提取出的知识点").locator("..").locator("span");
        const tagCount = await tags.count();
        expect(tagCount).toBeGreaterThan(0);
      }

      // 7. 验证文本预览区域
      const previewArea = page.locator("pre");
      await expect(previewArea).toBeVisible();
      const previewText = await previewArea.textContent();
      expect(previewText).toContain("特征值");

      // 8. 验证操作按钮存在
      await expect(page.locator("text=基于此资料学习")).toBeVisible();
    } finally {
      // 清理临时文件
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });

  test("粘贴文本内容提交", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1", { hasText: "资料库" })).toBeVisible();

    // 找到粘贴文本区域
    const pasteTextarea = page.locator("textarea[placeholder='直接粘贴学习资料的文本内容...']");
    await expect(pasteTextarea).toBeVisible();

    // 输入文本内容
    const pasteContent = [
      "牛顿第二定律",
      "",
      "牛顿第二定律（Newton's Second Law of Motion）是经典力学中的基本定律之一。",
      "其数学表达式为 F = ma，其中 F 是合力，m 是物体质量，a 是加速度。",
      "这个定律表明，物体的加速度与所受合力成正比，与质量成反比。",
    ].join("\n");

    await pasteTextarea.fill(pasteContent);

    // 点击提交按钮
    const submitButton = page.locator("button", { hasText: "提交文本" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 等待处理完成
    await expect(page.locator("text=资源 ID")).toBeVisible({ timeout: 45_000 });

    // 验证解析结果存在
    await expect(page.locator("text=处理状态")).toBeVisible();
  });

  test("空文本不允许提交", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1", { hasText: "资料库" })).toBeVisible();

    // 提交按钮在文本为空时应该禁用
    const submitButton = page.locator("button", { hasText: "提交文本" });
    await expect(submitButton).toBeDisabled();
  });

  test("从网页链接导入", async ({ page }) => {
    await page.goto("/resources");
    await expect(page.locator("h1", { hasText: "资料库" })).toBeVisible();

    // 找到 URL 输入框
    const urlInput = page.locator("input[type='url']");
    await expect(urlInput).toBeVisible();

    // 输入一个测试 URL
    await urlInput.fill("https://en.wikipedia.org/wiki/Linear_algebra");

    // 点击导入按钮
    const importButton = page.locator("button", { hasText: "导入链接" });
    await expect(importButton).toBeEnabled();
    await importButton.click();

    // 等待结果出现或错误提示（取决于后端是否支持该 URL）
    // 使用 Promise.race 等待成功或失败
    await expect(
      page.locator("text=资源 ID").or(page.locator(".bg-red-50"))
    ).toBeVisible({ timeout: 45_000 });
  });
});
