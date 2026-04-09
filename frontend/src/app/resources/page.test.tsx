import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResourcesPage from "./page";

vi.mock("@/components/layout/MainShell", () => ({
  MainShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const uploadResource = vi.fn();
const importUrlResource = vi.fn();

vi.mock("@/lib/api", () => ({
  uploadResource: (file: File) => uploadResource(file),
  importUrlResource: (url: string) => importUrlResource(url),
}));

describe("ResourcesPage", () => {
  beforeEach(() => {
    uploadResource.mockReset();
    importUrlResource.mockReset();
  });

  it("展示新的资源处理状态和知识点", async () => {
    uploadResource.mockResolvedValue({
      resource_id: "res-1",
      filename: "algebra.txt",
      text: "线性代数研究向量空间。",
      pages: 1,
      chunks: 1,
      embedded: true,
      status: "ready",
      source_type: "file",
      knowledge_points: ["向量空间", "线性变换"],
    });

    render(<ResourcesPage />);

    const input = screen.getByLabelText("选择文件");
    const file = new File(["线性代数"], "algebra.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("资源 ID：res-1")).toBeInTheDocument();
    });

    expect(screen.getByText("来源类型：file")).toBeInTheDocument();
    expect(screen.getByText("处理状态：ready")).toBeInTheDocument();
    expect(screen.getByText("向量空间")).toBeInTheDocument();
    expect(screen.getByText("线性变换")).toBeInTheDocument();
  });

  it("支持导入网页链接", async () => {
    importUrlResource.mockResolvedValue({
      resource_id: "res-url-1",
      filename: "线性代数导论",
      text: "向量空间是线性代数的核心对象。",
      pages: 1,
      chunks: 1,
      embedded: true,
      status: "ready",
      source_type: "url",
      source_url: "https://example.com/linear-algebra",
      knowledge_points: ["向量空间"],
    });

    render(<ResourcesPage />);

    fireEvent.change(screen.getByPlaceholderText("粘贴网页链接，例如 https://example.com/article"), {
      target: { value: "https://example.com/linear-algebra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导入链接" }));

    await waitFor(() => {
      expect(screen.getByText("来源类型：url")).toBeInTheDocument();
    });

    expect(screen.getByText("来源链接：https://example.com/linear-algebra")).toBeInTheDocument();
    expect(importUrlResource).toHaveBeenCalledWith("https://example.com/linear-algebra");
  });
});
