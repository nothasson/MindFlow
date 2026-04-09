import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell 覆盖式抽屉", () => {
  it("默认状态下不应渲染侧栏抽屉", () => {
    render(
      <AppShell sidebar={<div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("应渲染侧栏开关按钮", () => {
    render(
      <AppShell sidebar={<div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    expect(screen.getByRole("button", { name: /切换侧栏/i })).toBeInTheDocument();
  });

  it("点击开关按钮应显示覆盖式抽屉", () => {
    render(
      <AppShell sidebar={<div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    const toggleBtn = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(toggleBtn);
    // 抽屉打开后应显示遮罩层
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();
  });

  it("点击遮罩层应关闭抽屉", () => {
    render(
      <AppShell sidebar={<div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    const toggleBtn = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(toggleBtn);
    const overlay = screen.getByTestId("sidebar-overlay");
    fireEvent.click(overlay);
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });

  it("抽屉打开时再次点击按钮应关闭抽屉", () => {
    render(
      <AppShell sidebar={<div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    const toggleBtn = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });
});
