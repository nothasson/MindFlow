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
});
