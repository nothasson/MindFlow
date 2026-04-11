import { test, expect } from "@playwright/test";

/**
 * 知识测验 E2E 测试
 *
 * 测试流程：
 * 1. 打开 /quiz 页面
 * 2. 等待薄弱知识点加载
 * 3. 开始测验（题目测验 / 对话考察）
 * 4. 作答并提交
 * 5. 验证评分和解析
 */

test.describe("知识测验", () => {
  test("题目测验完整流程", async ({ page }) => {
    await page.goto("/quiz");

    // 1. 验证页面标题
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    // 2. 等待加载完成（"正在分析你的学习状态..."消失）
    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    // 3. 判断页面状态：有知识点 or 无知识点
    const noDataMessage = page.locator("text=还没有知识点数据");
    const hasNoData = await noDataMessage.isVisible().catch(() => false);

    if (hasNoData) {
      // 无知识点时：验证引导态，应该有"开始学习"链接
      await expect(page.locator("text=开始学习")).toBeVisible();
      // 跳过后续测验流程
      test.skip(true, "暂无知识点数据，跳过测验流程");
      return;
    }

    // 4. 有知识点时：应该展示 AI 推荐卡片
    const aiRecommend = page.locator("text=AI 推荐");
    await expect(aiRecommend).toBeVisible({ timeout: 10_000 });

    // 验证推荐的概念名称不为空
    const conceptText = page.locator("text=AI 推荐").locator("..").locator("..").locator("p.text-lg");
    await expect(conceptText).toBeVisible();

    // 5. 点击"题目测验"按钮开始出题
    const quizButton = page.locator("button", { hasText: "题目测验" });
    await expect(quizButton).toBeVisible();
    await quizButton.click();

    // 6. 等待题目生成（可能需要较长时间，LLM 出题）
    // 出题中按钮应显示"出题中..."
    await expect(page.locator("text=出题中...").or(page.locator("text=第 1"))).toBeVisible({
      timeout: 10_000,
    });

    // 等待题目出现：进度条 "第 1 / X 题"
    await expect(page.locator("text=/第 1 \\/ \\d+ 题/")).toBeVisible({ timeout: 45_000 });

    // 7. 验证题目内容区域
    const questionArea = page.locator(".rounded-2xl.border.border-stone-200.bg-white.p-6").first();
    await expect(questionArea).toBeVisible();
    const questionText = await questionArea.textContent();
    expect(questionText!.length).toBeGreaterThan(10);

    // 8. 输入答案
    const answerTextarea = page.locator("textarea[placeholder='写下你的答案...']");
    await expect(answerTextarea).toBeVisible();
    await answerTextarea.fill("特征值是矩阵在线性变换下不改变方向的向量对应的缩放因子。通过求解特征方程 det(A - λI) = 0 可以得到特征值。");

    // 9. 提交答案
    const submitButton = page.locator("button", { hasText: "提交答案" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // 10. 等待评分结果
    // 按钮变为"评分中，请稍候..."
    await expect(
      page.locator("text=评分中，请稍候...").or(page.locator("text=得分"))
    ).toBeVisible({ timeout: 10_000 });

    // 等待评分完成：显示 "得分：X/5"
    await expect(page.locator("text=/得分：\\d\\/5/")).toBeVisible({ timeout: 45_000 });

    // 11. 验证评分标签（"回答正确" 或 "需要巩固"）
    const correctLabel = page.locator("text=回答正确");
    const needPractice = page.locator("text=需要巩固");
    await expect(correctLabel.or(needPractice)).toBeVisible();

    // 12. 验证解析区域
    const explanationSection = page.locator("text=解析");
    const hasExplanation = await explanationSection.isVisible().catch(() => false);
    if (hasExplanation) {
      // 解析内容应该非空
      const explanationText = await explanationSection.locator("..").locator("p.text-sm").textContent();
      expect(explanationText!.length).toBeGreaterThan(5);
    }

    // 13. 点击下一题或查看总结
    const nextButton = page.locator("button", { hasText: /下一题|查看总结/ });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  });

  test("对话考察流程", async ({ page }) => {
    await page.goto("/quiz");
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    // 等待加载完成
    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    // 检查是否有知识点
    const hasNoData = await page.locator("text=还没有知识点数据").isVisible().catch(() => false);
    if (hasNoData) {
      test.skip(true, "暂无知识点数据，跳过对话考察测试");
      return;
    }

    // 等待 AI 推荐出现
    await expect(page.locator("text=AI 推荐")).toBeVisible({ timeout: 10_000 });

    // 点击"对话考察"按钮
    const convButton = page.locator("button", { hasText: "对话考察" });
    await expect(convButton).toBeVisible();
    await convButton.click();

    // 等待对话考察界面出现
    await expect(page.locator("text=对话考察")).toBeVisible({ timeout: 10_000 });

    // 等待 AI 的第一个问题出现
    const aiMessage = page.locator("text=考察导师").first();
    await expect(aiMessage).toBeVisible({ timeout: 45_000 });

    // 验证 AI 问题内容非空
    const firstAiContent = page.locator(".rounded-2xl.border.border-stone-200.bg-white").first();
    const aiText = await firstAiContent.textContent();
    expect(aiText!.length).toBeGreaterThan(10);

    // 输入回答（对话考察复用 ChatInput 组件，placeholder 为"输入你想学的内容..."）
    const chatInput = page.locator("textarea[placeholder*='输入']");
    await expect(chatInput).toBeVisible();
    await chatInput.fill("我认为这个概念的核心在于数学表达式的推导过程。");

    // 发送回答（按 Enter 或点击发送按钮）
    const sendButton = page.locator("form button[type='submit']");
    await sendButton.click();

    // 等待 AI 的下一轮回复
    await expect(async () => {
      const aiMsgs = page.locator("text=考察导师");
      const count = await aiMsgs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 45_000 });

    // 验证能退出对话考察
    const exitButton = page.locator("button", { hasText: "退出考察" });
    await expect(exitButton).toBeVisible();
    await exitButton.click();

    // 退出后应该回到推荐界面
    await expect(page.locator("text=AI 推荐")).toBeVisible({ timeout: 10_000 });
  });

  test("通过 URL 参数指定测验概念", async ({ page }) => {
    // 通过 URL 参数 ?concept=矩阵 直接指定要测验的概念
    await page.goto("/quiz?concept=矩阵");
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    // 等待加载完成
    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    // 验证概念名称显示为 URL 中指定的概念
    await expect(page.locator("text=矩阵")).toBeVisible({ timeout: 10_000 });
  });

  test("Anki 卡片模式翻卡自评", async ({ page }) => {
    await page.goto("/quiz");
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    // 等待加载完成
    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    const hasNoData = await page.locator("text=还没有知识点数据").isVisible().catch(() => false);
    if (hasNoData) {
      test.skip(true, "暂无知识点数据，跳过 Anki 卡片测试");
      return;
    }

    await expect(page.locator("text=AI 推荐")).toBeVisible({ timeout: 10_000 });

    // 点击 "Anki 卡片" 按钮
    const ankiButton = page.locator("button", { hasText: "Anki 卡片" });
    await expect(ankiButton).toBeVisible();
    await ankiButton.click();

    // 等待卡片生成（同时触发 generateQuiz）
    // 应出现 Anki 卡片界面
    await expect(page.locator("text=Anki 卡片").first()).toBeVisible({ timeout: 45_000 });

    // 验证"点击翻转查看参考"提示
    await expect(page.locator("text=点击翻转查看参考")).toBeVisible({ timeout: 10_000 });

    // 点击卡片翻转
    const card = page.locator(".cursor-pointer.rounded-2xl");
    await card.click();

    // 翻转后应显示"参考思路已展示"
    await expect(page.locator("text=参考思路已展示")).toBeVisible();

    // 验证四个 FSRS 评分按钮出现
    await expect(page.locator("button", { hasText: "重来" })).toBeVisible();
    await expect(page.locator("button", { hasText: "困难" })).toBeVisible();
    await expect(page.locator("button", { hasText: "良好" })).toBeVisible();
    await expect(page.locator("button", { hasText: "轻松" })).toBeVisible();

    // 点击"良好"评分
    await page.locator("button", { hasText: "良好" }).click();

    // 应进入下一张卡或结束
    // 验证进度变化或测验完成
    const nextCardOrFinished = page.locator("text=点击翻转查看参考").or(
      page.locator("text=测验完成")
    );
    await expect(nextCardOrFinished).toBeVisible({ timeout: 10_000 });
  });

  test("完成所有题目后展示总结", async ({ page }) => {
    await page.goto("/quiz");
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    const hasNoData = await page.locator("text=还没有知识点数据").isVisible().catch(() => false);
    if (hasNoData) {
      test.skip(true, "暂无知识点数据，跳过总结测试");
      return;
    }

    await expect(page.locator("text=AI 推荐")).toBeVisible({ timeout: 10_000 });

    // 开始题目测验
    await page.locator("button", { hasText: "题目测验" }).click();
    await expect(page.locator("text=/第 1 \\/ \\d+ 题/")).toBeVisible({ timeout: 45_000 });

    // 循环答题直到出现"查看总结"
    let maxRounds = 10;
    while (maxRounds > 0) {
      maxRounds--;

      const answerTextarea = page.locator("textarea[placeholder='写下你的答案...']");
      const isAnswerVisible = await answerTextarea.isVisible().catch(() => false);
      if (!isAnswerVisible) break;

      await answerTextarea.fill("这是我的回答。");
      await page.locator("button", { hasText: "提交答案" }).click();

      // 等待评分
      await expect(
        page.locator("text=回答正确").or(page.locator("text=需要巩固"))
      ).toBeVisible({ timeout: 45_000 });

      // 点击下一题 / 查看总结
      const summaryBtn = page.locator("button", { hasText: "查看总结" });
      if (await summaryBtn.isVisible().catch(() => false)) {
        await summaryBtn.click();
        break;
      }
      await page.locator("button", { hasText: "下一题" }).click();
    }

    // 验证总结界面
    await expect(page.locator("text=测验完成")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=总题数")).toBeVisible();
    await expect(page.locator("text=答对")).toBeVisible();
    await expect(page.locator("text=平均分")).toBeVisible();

    // 验证"再来一轮"按钮可点击
    const retryButton = page.locator("text=再来一轮");
    await expect(retryButton).toBeVisible();
  });

  test("无知识点时展示空态引导", async ({ page }) => {
    // 这个测试验证在没有学习数据时，页面展示正确的引导信息
    // 由于我们无法控制后端数据，此测试仅验证页面不崩溃且有合理的展示
    await page.goto("/quiz");
    await expect(page.locator("h1", { hasText: "知识测验" })).toBeVisible();

    // 等待加载完成
    await expect(page.locator("text=正在分析你的学习状态")).toBeHidden({ timeout: 15_000 });

    // 页面应该展示以下之一：
    // - "还没有知识点数据" + "开始学习" 引导
    // - AI 推荐卡片（有数据的情况）
    const emptyState = page.locator("text=还没有知识点数据");
    const recommendState = page.locator("text=AI 推荐");
    await expect(emptyState.or(recommendState)).toBeVisible({ timeout: 10_000 });
  });
});
