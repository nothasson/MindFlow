"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { importUrlResource, uploadResource, generateCourse, getCourses, deleteCourse, getResources, deleteResource, type Course } from "@/lib/api";
import type { Resource, ResourceUploadResult } from "@/lib/types";
import { usePromptTemplates } from "@/hooks/usePromptTemplates";

/** 安全解码 URL 编码的文件名 */
function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** 从课程 summary 中提取简短摘要 */
function extractBrief(summary: string): string {
  const parts = summary.split(/\n---\n/);
  const first = parts[0] || summary;
  const lines = first.split("\n").filter((l: string) => !l.startsWith("## ") && !l.startsWith("### "));
  const text = lines.join("\n").trim();
  return text.length > 200 ? text.slice(0, 200) + "..." : text;
}

type Tab = "resources" | "courses";

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("resources");
  const [uploading, setUploading] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState<ResourceUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { fill } = usePromptTemplates();

  // 已上传资料列表
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    try {
      const data = await getResources();
      setResources(data);
    } catch {
      // 静默
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // 课程列表状态
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const data = await getCourses();
      setCourses(data.courses || []);
    } catch (err) {
      console.error("获取课程失败:", err);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "courses") fetchCourses();
  }, [activeTab, fetchCourses]);

  const applyResult = useCallback((data: ResourceUploadResult) => {
    setResult(data);
    setError(null);
    fetchResources(); // 上传成功后刷新列表
  }, [fetchResources]);

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
    if (!trimmed) { setError("请输入网页链接"); return; }
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
    if (!trimmed) { setError("请输入文本内容"); return; }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleDeleteCourse = async (id: string) => {
    try {
      await deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("删除课程失败");
    }
  };

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <h1 className="mb-1 text-2xl font-semibold text-stone-800">资料库</h1>
          <p className="mb-6 text-sm text-stone-500">上传学习资料，AI 自动解析并生成课程进行教学。</p>

          {/* Tab 切换 */}
          <div className="mb-6 flex gap-4 border-b border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab("resources")}
              className={activeTab === "resources"
                ? "border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]"
                : "pb-2 text-sm text-stone-400 hover:text-stone-600"}
            >
              资料上传
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("courses")}
              className={activeTab === "courses"
                ? "border-b-2 border-[#C67A4A] pb-2 text-sm font-medium text-[#C67A4A]"
                : "pb-2 text-sm text-stone-400 hover:text-stone-600"}
            >
              我的课程
              {courses.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C67A4A]/15 px-1 text-[10px] text-[#C67A4A]">
                  {courses.length}
                </span>
              )}
            </button>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          {/* ========== 资料上传 Tab ========== */}
          {activeTab === "resources" ? (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center transition hover:border-stone-400"
              >
                {uploading ? (
                  <>
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-3 border-stone-300 border-t-[#C67A4A]" />
                    <p className="text-stone-600">正在上传并解析资料...</p>
                    <p className="mt-1 text-xs text-stone-400">AI 正在提取知识点，请稍候</p>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-stone-600">拖拽文件到此处，或点击选择</p>
                    <label className="cursor-pointer rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700">
                      选择文件
                      <input type="file" accept=".pdf,.txt,.md,.docx,.pptx" onChange={handleFileInput} className="hidden" disabled={uploading} />
                    </label>
                    <p className="mt-3 text-xs text-stone-400">支持 PDF、Word、PPT、TXT、Markdown</p>
                  </>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                <h2 className="text-sm font-medium text-stone-700">从网页链接导入</h2>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="url"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                    placeholder="粘贴网页链接，例如 https://example.com/article"
                    className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400"
                    disabled={uploading}
                  />
                  <button type="button" onClick={handleImportUrl} disabled={uploading}
                    className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60">
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
                  className="mt-3 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400"
                  disabled={uploading}
                />
                <button type="button" onClick={handlePasteSubmit} disabled={uploading || !pasteText.trim()}
                  className="mt-3 rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60">
                  提交文本
                </button>
              </div>

              {result ? (
                <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
                  <h2 className="mb-2 text-lg font-semibold text-stone-800">{decodeName(result.filename)}</h2>
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
                          <span key={point} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{point}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {result.summary ? (
                    <div className="mb-4 rounded-xl bg-amber-50 p-4">
                      <h3 className="mb-2 text-sm font-medium text-stone-700">资料摘要</h3>
                      <p className="text-sm leading-relaxed text-stone-600">{result.summary}</p>
                    </div>
                  ) : null}

                  {result.questions && result.questions.length > 0 ? (
                    <div className="mb-4 rounded-xl bg-blue-50 p-4">
                      <h3 className="mb-2 text-sm font-medium text-stone-700">建议学习问题</h3>
                      <ul className="space-y-2">
                        {result.questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">{i + 1}</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mb-4 flex gap-3">
                    <Link href={`/?q=${encodeURIComponent(fill("learn_resource", { filename: decodeName(result.filename) }))}`}
                      className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a]">
                      基于此资料学习
                    </Link>
                    <button type="button"
                      onClick={async () => {
                        setGenerating(true);
                        try {
                          const data = await generateCourse(result.resource_id, "beginner");
                          if (data.course?.id) window.location.href = `/courses/${data.course.id}`;
                        } catch { setError("课程生成失败，请重试"); }
                        finally { setGenerating(false); }
                      }}
                      disabled={generating}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:text-stone-400">
                      {generating && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-[#C67A4A]" />}
                      {generating ? "AI 正在生成课程..." : "生成章节课程"}
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
                    <pre className="whitespace-pre-wrap">{result.text.slice(0, 3000)}</pre>
                    {result.text.length > 3000 ? <p className="mt-2 text-stone-400">...（已截断显示前 3000 字符）</p> : null}
                  </div>
                </div>
              ) : null}

              {/* 已上传资料列表 */}
              <div className="mt-6">
                <h2 className="mb-3 text-base font-semibold text-stone-800">已上传资料</h2>
                {resourcesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-[#C67A4A]" />
                  </div>
                ) : resources.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
                    <p className="text-sm text-stone-400">暂无资料，上传文件开始学习</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resources.map((res) => (
                      <div key={res.id} className="rounded-xl border border-stone-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-stone-800">{decodeName(res.filename)}</h3>
                            {res.summary ? <p className="mt-1 text-xs text-stone-400 line-clamp-2">{res.summary}</p> : null}
                            <div className="mt-2 flex items-center gap-3 text-xs text-stone-400">
                              {res.pages > 0 ? <span>{res.pages} 页</span> : null}
                              {res.chunks > 0 ? <span>{res.chunks} 块</span> : null}
                              <span>{new Date(res.created_at).toLocaleDateString("zh-CN")}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Link
                              href={`/?q=${encodeURIComponent(fill("learn_resource", { filename: decodeName(res.filename) }))}`}
                              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs text-white transition hover:bg-stone-700"
                            >
                              学习
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                setGenerating(true);
                                try {
                                  const data = await generateCourse(res.id, "beginner");
                                  if (data.course?.id) window.location.href = `/courses/${data.course.id}`;
                                } catch { setError("课程生成失败"); }
                                finally { setGenerating(false); }
                              }}
                              disabled={generating}
                              className="rounded-lg border border-[#C67A4A] px-3 py-1.5 text-xs text-[#C67A4A] transition hover:bg-[#C67A4A]/10 disabled:opacity-50"
                            >
                              生成课程
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteResource(res.id);
                                  setResources((prev) => prev.filter((r) => r.id !== res.id));
                                } catch { setError("删除失败"); }
                              }}
                              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ========== 我的课程 Tab ========== */
            <>
              {coursesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-stone-300 border-t-[#C67A4A]" />
                </div>
              ) : courses.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
                  <p className="mb-2 text-stone-500">还没有课程</p>
                  <p className="mb-4 text-sm text-stone-400">上传资料后点击"生成章节课程"即可创建</p>
                  <button type="button" onClick={() => setActiveTab("resources")}
                    className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700">
                    前往上传资料
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {courses.map((course) => (
                    <div key={course.id} className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold text-stone-800">{decodeName(course.title)}</h2>
                          {course.summary ? <p className="mt-1 text-sm text-stone-500 line-clamp-2">{extractBrief(course.summary)}</p> : null}
                          <div className="mt-3 flex items-center gap-3 text-xs text-stone-400">
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5">
                              {course.difficulty_level === "beginner" ? "初学" : course.difficulty_level === "advanced" ? "进阶" : "专家"}
                            </span>
                            <span>{course.section_count} 个章节</span>
                            <span>{new Date(course.created_at).toLocaleDateString("zh-CN")}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Link href={`/courses/${course.id}`}
                            className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]">
                            开始学习
                          </Link>
                          <button type="button" onClick={() => handleDeleteCourse(course.id)}
                            className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-400 transition hover:bg-red-50 hover:text-red-500">
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainShell>
  );
}
