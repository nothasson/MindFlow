"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { importUrlResource, uploadResource } from "@/lib/api";
import type { ResourceUploadResult } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function ResourcesPage() {
  const [uploading, setUploading] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState<ResourceUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const applyResult = useCallback((data: ResourceUploadResult) => {
    setResult(data);
    setError(null);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const data = await uploadResource(file);
      applyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }, [applyResult]);

  const handleImportUrl = useCallback(async () => {
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setError("请输入网页链接");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const data = await importUrlResource(trimmed);
      applyResult(data);
      setUrlValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setUploading(false);
    }
  }, [applyResult, urlValue]);

  const handlePasteSubmit = useCallback(async () => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setError("请输入文本内容");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      // 将粘贴的纯文本包装为 .txt 文件后上传
      const blob = new Blob([trimmed], { type: "text/plain" });
      const file = new File([blob], "pasted-text.txt", { type: "text/plain" });
      const data = await uploadResource(file);
      applyResult(data);
      setPasteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setUploading(false);
    }
  }, [applyResult, pasteText]);

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
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">资料库</h1>
          <p className="mb-8 text-sm text-stone-500">
            上传学习资料，或直接粘贴网页链接，AI 会自动解析并基于内容进行教学。
          </p>


          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center transition hover:border-stone-400"
          >
            <p className="mb-4 text-stone-600">
              {uploading ? "正在处理..." : "拖拽文件到此处，或点击选择"}
            </p>
            <label className="cursor-pointer rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700">
              选择文件
              <input
                type="file"
                accept=".pdf,.txt,.md,.docx,.pptx"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
            </label>
            <p className="mt-3 text-xs text-stone-400">支持 PDF、Word、PPT、TXT、Markdown</p>
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-medium text-stone-700">从网页链接导入</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="粘贴网页链接，例如 https://example.com/article"
                className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-0 placeholder:text-stone-400 focus:border-stone-400"
                disabled={uploading}
              />
              <button
                type="button"
                onClick={handleImportUrl}
                disabled={uploading}
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                导入链接
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-medium text-stone-700">粘贴文本内容</h2>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="直接粘贴学习资料的文本内容..."
              rows={5}
              className="mt-3 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-0 placeholder:text-stone-400 focus:border-stone-400"
              disabled={uploading}
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              disabled={uploading || !pasteText.trim()}
              className="mt-3 rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              提交文本
            </button>
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
              <div className="space-y-1 text-sm text-stone-500">
                <p>资源 ID：{result.resource_id}</p>
                <p>来源类型：{result.source_type}</p>
                {result.source_url ? <p>来源链接：{result.source_url}</p> : null}
                <p>处理状态：{result.status}</p>
                <p>共 {result.pages} 页，提取了 {result.text.length} 个字符，分块 {result.chunks} 段</p>
              </div>
              <p className="mb-4 mt-2 text-xs text-stone-400">
                向量索引：{result.embedded ? "已建立" : "未建立"}
                {result.warning ? ` · ${result.warning}` : ""}
              </p>

              {result.knowledge_points.length > 0 ? (
                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-medium text-stone-700">提取出的知识点</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.knowledge_points.map((point) => (
                      <span
                        key={point}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 资料摘要 */}
              {result.summary ? (
                <div className="mb-4 rounded-xl bg-amber-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-stone-700">资料摘要</h3>
                  <p className="text-sm leading-relaxed text-stone-600">{result.summary}</p>
                </div>
              ) : null}

              {/* 建议学习问题 */}
              {result.questions && result.questions.length > 0 ? (
                <div className="mb-4 rounded-xl bg-blue-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-stone-700">建议学习问题</h3>
                  <ul className="space-y-2">
                    {result.questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                          {i + 1}
                        </span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* 操作按钮 */}
              <div className="mb-4 flex gap-3">
                <Link
                  href={`/?q=${encodeURIComponent(result.filename)}`}
                  className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a]"
                >
                  基于此资料学习
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const res = await fetch(`${API_URL}/api/resources/${result.resource_id}/generate-course`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ difficulty: "beginner" }),
                      });
                      if (!res.ok) throw new Error("生成失败");
                      const data = await res.json();
                      if (data.course?.id) {
                        window.location.href = `/courses/${data.course.id}`;
                      }
                    } catch {
                      setError("课程生成失败，请重试");
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:text-stone-400"
                >
                  {generating ? "生成中..." : "生成章节课程"}
                </button>
              </div>

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
    </MainShell>
  );
}
