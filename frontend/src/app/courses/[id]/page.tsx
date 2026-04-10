"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Course {
  id: string;
  title: string;
  summary: string;
  difficulty_level: string;
  section_count: number;
  created_at: string;
}

interface Section {
  id: string;
  title: string;
  summary: string;
  content: string;
  order_index: number;
  learning_objectives: string;
  question_prompts: string;
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/courses/${courseId}`);
      if (!res.ok) throw new Error("加载课程失败");
      const data = await res.json();
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
        <h2 className="mb-4 text-lg font-semibold text-stone-800">{course.title}</h2>
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
              第 {idx + 1} 章：{section.title}
            </button>
          ))}
        </div>
      </aside>

      {/* 章节内容 */}
      <main className="flex-1 overflow-y-auto p-8">
        {currentSection ? (
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-2 text-2xl font-semibold text-stone-800">
              第 {activeSection + 1} 章：{currentSection.title}
            </h1>

            {currentSection.summary ? (
              <p className="mb-6 text-sm text-stone-500">{currentSection.summary}</p>
            ) : null}

            {currentSection.learning_objectives ? (
              <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
                <h3 className="mb-2 text-sm font-semibold text-stone-700">学习目标</h3>
                <div className="text-sm text-stone-600 whitespace-pre-wrap">
                  {currentSection.learning_objectives}
                </div>
              </div>
            ) : null}

            {currentSection.content ? (
              <div className="mb-6 text-[15px] leading-7 text-stone-800 whitespace-pre-wrap">
                {currentSection.content}
              </div>
            ) : null}

            {currentSection.question_prompts ? (
              <div className="mb-6 rounded-2xl border border-[#C67A4A]/20 bg-[#C67A4A]/5 p-5">
                <h3 className="mb-2 text-sm font-semibold text-[#C67A4A]">思考与讨论</h3>
                <div className="text-sm text-stone-700 whitespace-pre-wrap">
                  {currentSection.question_prompts}
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
                href="/"
                className="rounded-lg border border-[#C67A4A] px-4 py-2 text-sm text-[#C67A4A] transition hover:bg-[#C67A4A]/10"
              >
                进入对话学习
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
