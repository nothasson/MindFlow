import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatInput } from "./ChatInput";

describe("ChatInput", () => {
  const onSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Enter 提交消息", async () => {
    const user = userEvent.setup();
    render(<ChatInput isLoading={false} onSend={onSend} />);

    const input = screen.getByPlaceholderText("输入你想学的内容...");
    await user.type(input, "什么是递归");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("什么是递归");
  });

  it("空内容不提交", async () => {
    const user = userEvent.setup();
    render(<ChatInput isLoading={false} onSend={onSend} />);

    const input = screen.getByPlaceholderText("输入你想学的内容...");
    await user.click(input);
    await user.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("loading 时发送按钮禁用", () => {
    render(<ChatInput isLoading={true} onSend={onSend} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
