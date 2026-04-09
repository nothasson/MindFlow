import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell 侧栏展开/收起", () => {
  it("默认状态下不应渲染展开的侧栏", () => {
    render(
      <AppShell onNewChat={() => {}} sidebar={() => <div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("侧栏内容")).not.toBeInTheDocument();
  });

  it("默认状态下应渲染收起态图标条", () => {
    render(
      <AppShell onNewChat={() => {}} sidebar={() => <div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    expect(screen.getByRole("button", { name: /切换侧栏/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /知识图谱/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /学习仪表盘/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /复习计划/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新建对话/i })).toBeInTheDocument();
  });

  it("点击展开按钮应显示侧栏", () => {
    render(
      <AppShell onNewChat={() => {}} sidebar={() => <div>侧栏内容</div>}>
        <div>主内容</div>
      </AppShell>
    );
    const expandBtn = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText("侧栏内容")).toBeInTheDocument();
  });

  it("sidebar 收到 onCollapse 回调并调用后应收起侧栏", () => {
    render(
      <AppShell
        onNewChat={() => {}}
        sidebar={(onCollapse) => (
          <div>
            侧栏内容
            <button onClick={onCollapse}>收起</button>
          </div>
        )}
      >
        <div>主内容</div>
      </AppShell>
    );
    // 先展开
    const expandBtn = screen.getByRole("button", { name: /切换侧栏/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText("侧栏内容")).toBeInTheDocument();
    // 点击收起
    fireEvent.click(screen.getByText("收起"));
    expect(screen.queryByText("侧栏内容")).not.toBeInTheDocument();
  });
});
