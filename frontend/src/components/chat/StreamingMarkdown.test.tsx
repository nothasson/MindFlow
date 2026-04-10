import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StreamingMarkdown } from "./StreamingMarkdown";

describe("StreamingMarkdown", () => {
  it("isStreaming=false 时完整渲染 Markdown", () => {
    render(<StreamingMarkdown content={"# 标题\n\n段落内容"} isStreaming={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("段落内容")).toBeInTheDocument();
  });

  it("isStreaming=true 时未闭合部分用纯文本", () => {
    render(<StreamingMarkdown content={"# 标题\n\n正在输入"} isStreaming={true} />);
    // 已闭合的标题应该渲染为 heading
    expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
    // 未闭合的尾部应该是纯文本
    expect(screen.getByText("正在输入")).toBeInTheDocument();
  });

  it("空内容不报错", () => {
    render(<StreamingMarkdown content="" isStreaming={false} />);
    // 不应该报错
  });

  it("isStreaming=true 且内容为空时不报错", () => {
    render(<StreamingMarkdown content="" isStreaming={true} />);
  });
});
