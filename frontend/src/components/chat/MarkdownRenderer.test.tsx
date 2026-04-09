import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("渲染标题和列表", () => {
    render(<MarkdownRenderer content={"# 标题\n\n- A\n- B"} />);

    expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("把 mermaid 代码块交给 MermaidBlock 渲染", () => {
    render(<MarkdownRenderer content={"```mermaid\ngraph TD; A-->B;\n```"} />);

    expect(screen.getByRole("button", { name: "查看源码" })).toBeInTheDocument();
    expect(screen.getByTestId("mermaid-diagram")).toBeInTheDocument();
  });
});
