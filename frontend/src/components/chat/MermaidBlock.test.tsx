import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MermaidBlock } from "./MermaidBlock";

describe("MermaidBlock", () => {
  it("在图与源码之间切换", async () => {
    const user = userEvent.setup();

    render(<MermaidBlock code={"graph TD; A-->B;"} />);

    expect(screen.getByRole("button", { name: "查看源码" })).toBeInTheDocument();
    expect(screen.getByTestId("mermaid-diagram")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看源码" }));

    expect(screen.getByText("graph TD; A-->B;")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看图" })).toBeInTheDocument();
  });
});
