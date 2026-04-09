import { describe, expect, it } from "vitest";

import { parseStreamingMarkdown } from "./markdown-parser";

describe("parseStreamingMarkdown", () => {
  it("空文本返回空结果", () => {
    const result = parseStreamingMarkdown("");
    expect(result.closedContent).toBe("");
    expect(result.pendingContent).toBe("");
  });

  it("无段落分隔的文本全部为 pending", () => {
    const result = parseStreamingMarkdown("正在输入中");
    expect(result.closedContent).toBe("");
    expect(result.pendingContent).toBe("正在输入中");
  });

  it("完整段落被标记为 closed", () => {
    const result = parseStreamingMarkdown("第一段内容\n\n第二段正在输入");
    expect(result.closedContent).toBe("第一段内容\n\n");
    expect(result.pendingContent).toBe("第二段正在输入");
  });

  it("多段落只有最后一段为 pending", () => {
    const text = "段落一\n\n段落二\n\n段落三正在输入";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("段落一\n\n段落二\n\n");
    expect(result.pendingContent).toBe("段落三正在输入");
  });

  it("以双换行结尾时全部为 closed", () => {
    const result = parseStreamingMarkdown("完整内容\n\n");
    expect(result.closedContent).toBe("完整内容\n\n");
    expect(result.pendingContent).toBe("");
  });

  it("未闭合代码块从开始位置切分", () => {
    const text = "前面的段落\n\n```python\ndef hello():";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("前面的段落\n\n");
    expect(result.pendingContent).toBe("```python\ndef hello():");
  });

  it("已闭合代码块全部为 closed", () => {
    const text = "段落\n\n```js\nconst x = 1;\n```\n\n后续";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("段落\n\n```js\nconst x = 1;\n```\n\n");
    expect(result.pendingContent).toBe("后续");
  });

  it("未闭合 mermaid 代码块", () => {
    const text = "说明\n\n```mermaid\ngraph TD;\nA-->B;";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("说明\n\n");
    expect(result.pendingContent).toBe("```mermaid\ngraph TD;\nA-->B;");
  });

  it("未闭合表格保持为 pending", () => {
    const text = "前文\n\n| 列A | 列B |\n| --- | --- |\n| 1 | 2 |";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("前文\n\n");
    expect(result.pendingContent).toContain("| 列A |");
  });

  it("未闭合列表保持为 pending", () => {
    const text = "前文\n\n- 项目一\n- 项目二";
    const result = parseStreamingMarkdown(text);
    expect(result.closedContent).toBe("前文\n\n");
    expect(result.pendingContent).toBe("- 项目一\n- 项目二");
  });
});
