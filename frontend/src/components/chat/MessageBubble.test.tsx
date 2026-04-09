import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble } from "./MessageBubble";

describe("MessageBubble", () => {
  it("assistant 消息按 Markdown 渲染", () => {
    render(<MessageBubble message={{ role: "assistant", content: "# 标题" }} />);

    expect(screen.getByRole("heading", { level: 1, name: "标题" })).toBeInTheDocument();
  });

  it("user 消息保持纯文本", () => {
    render(<MessageBubble message={{ role: "user", content: "# 不是标题" }} />);

    expect(screen.queryByRole("heading", { level: 1, name: "不是标题" })).not.toBeInTheDocument();
    expect(screen.getByText("# 不是标题")).toBeInTheDocument();
  });
});
