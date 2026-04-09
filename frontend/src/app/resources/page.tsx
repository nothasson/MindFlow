"use client";

import { useCallback, useState } from "react";

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? "http://localhost:8000";

interface UploadResult {
  filename: string;
  text: string;
  pages: number;
}

export default function ResourcesPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${AI_SERVICE_URL}/parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`解析失败 (${response.status})`);
      }

      const data = (await response.json()) as UploadResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  return (
    <div className="flex h-full flex-col bg-[#EEECE2]">
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold text-stone-800">资料库</h1>
        <p className="mb-8 text-sm text-stone-500">
          上传学习资料，AI 会自动解析并基于内容进行教学。
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center transition hover:border-stone-400"
        >
          <p className="mb-4 text-stone-600">
            {uploading ? "正在解析..." : "拖拽文件到此处，或点击选择"}
          </p>
          <label className="cursor-pointer rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700">
            选择文件
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <p className="mt-3 text-xs text-stone-400">支持 PDF、TXT、Markdown</p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold text-stone-800">
              {result.filename}
            </h2>
            <p className="mb-4 text-sm text-stone-500">
              共 {result.pages} 页，提取了 {result.text.length} 个字符
            </p>
            <div className="max-h-96 overflow-y-auto rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
              <pre className="whitespace-pre-wrap">{result.text.slice(0, 3000)}</pre>
              {result.text.length > 3000 ? (
                <p className="mt-2 text-stone-400">...（已截断显示前 3000 字符）</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
