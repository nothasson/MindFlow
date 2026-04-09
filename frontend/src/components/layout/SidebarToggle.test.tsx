import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidebarToggle } from "./SidebarToggle";

describe("SidebarToggle 组件", () => {
  it("应渲染一个可点击的按钮", () => {
    render(<SidebarToggle isOpen={false} onToggle={vi.fn()} />);
    const button = screen.getByRole("button", { name: /切换侧栏/i });
    expect(button).toBeInTheDocument();
  });

  it("点击按钮时应调用 onToggle", () => {
    const onToggle = vi.fn();
    render(<SidebarToggle isOpen={false} onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("isOpen=false 时应显示打开图标", () => {
    render(<SidebarToggle isOpen={false} onToggle={vi.fn()} />);
    // 使用 menu 图标（三横线）
    expect(screen.getByTestId("sidebar-toggle-open")).toBeInTheDocument();
  });

  it("isOpen=true 时应显示关闭图标", () => {
    render(<SidebarToggle isOpen={true} onToggle={vi.fn()} />);
    // 使用 close 图标（X）
    expect(screen.getByTestId("sidebar-toggle-close")).toBeInTheDocument();
  });
});
