"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { getCourse, type Course, type CourseSection } from "@/lib/api";
import { usePromptTemplates } from "@/hooks/usePromptTemplates";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";

/** 安全解码 URL 编码 */
function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** 从课程 summary 中提取简短摘要 */
function extractBrief(summary: string): string {
  const parts = summary.split(/\n---\n/);
  const first = parts[0] || summary;
  const lines = first.split("\n").filter((l: string) => !l.startsWith("## ") && !l.startsWith("### "));
  const text = lines.join("\n").trim();
  return text.length > 300 ? text.slice(0, 300) + "..." : text;
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { fill } = usePromptTemplates();

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const data = await getCourse(courseId);
      setCourse(data.course);
      setSections(data.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#EEECE2]">
        <p className="text-stone-400">加载中...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex h-full items-center justify-center bg-[#EEECE2]">
        <p className="text-red-600">{error || "课程不存在"}</p>
      </div>
    );
  }

  const currentSection = sections[activeSection];

  return (
    <div className="flex h-full bg-[#EEECE2]">
      {/* 章节导航 */}
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-stone-200 bg-[#EEECE2] p-4">
        <h2 className="mb-4 text-lg font-semibold text-stone-800">{decode(course.title)}</h2>
        <p className="mb-4 text-xs text-stone-400">
          {course.difficulty_level === "beginner" ? "初学" : course.difficulty_level === "advanced" ? "进阶" : "专家"}
        </p>
        <div className="space-y-1">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(idx)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                idx === activeSection
                  ? "bg-stone-200/70 font-medium text-stone-800"
                  : "text-stone-600 hover:bg-stone-200/50"
              }`}
            >
              第 {idx + 1} 章：{decode(section.title)}
            </button>
          ))}
        </div>
      </aside>

      {/* 章节内容 */}
      <main className="flex-1 overflow-y-auto p-8">
        {currentSection ? (
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-2 text-2xl font-semibold text-stone-800">
              第 {activeSection + 1} 章：{decode(currentSection.title)}
            </h1>

            {currentSection.summary ? (
              <div className="mb-6 text-sm text-stone-500">
                <MarkdownRenderer content={currentSection.summary} />
              </div>
            ) : null}

            {currentSection.learning_objectives ? (
              <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
                <h3 className="mb-2 text-sm font-semibold text-stone-700">学习目标</h3>
                <div className="text-sm text-stone-600">
                  <MarkdownRenderer content={currentSection.learning_objectives} />
                </div>
              </div>
            ) : null}

            {currentSection.content ? (
              <div className="mb-6 text-[15px] leading-7 text-stone-800">
                <MarkdownRenderer content={currentSection.content} />
              </div>
            ) : null}

            {currentSection.question_prompts ? (
              <div className="mb-6 rounded-2xl border border-[#C67A4A]/20 bg-[#C67A4A]/5 p-5">
                <h3 className="mb-2 text-sm font-semibold text-[#C67A4A]">思考与讨论</h3>
                <div className="text-sm text-stone-700">
                  <MarkdownRenderer content={currentSection.question_prompts} />
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              {activeSection > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveSection(activeSection - 1)}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-100"
                >
                  上一章
                </button>
              ) : null}
              {activeSection < sections.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveSection(activeSection + 1)}
                  className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
                >
                  下一章
                </button>
              ) : null}
              <Link
                href={`/?q=${encodeURIComponent(fill("learn_course_section", { course_title: decode(course.title), section_index: String(activeSection + 1), section_title: decode(currentSection.title), learning_objectives: currentSection.learning_objectives || '无' }))}`}
                className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]"
              >
                对话学习本章
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-stone-400">
              {sections.length === 0 ? "课程暂无章节内容" : "选择一个章节开始学习"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
