"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { getCourses, deleteCourse, type Course } from "@/lib/api";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCourses();
      setCourses(data.courses || []);
    } catch {
      setError("获取课程列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确定删除课程「${title}」吗？`)) return;
    try {
      await deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("删除失败");
    }
  };

  return (
    <MainShell>
      <div className="flex h-full flex-col bg-[#EEECE2]">
        <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-12">
          <h1 className="mb-2 text-2xl font-semibold text-stone-800">课程库</h1>
          <p className="mb-8 text-sm text-stone-500">
            基于学习资料生成的结构化课程，按章节系统学习。
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-stone-300 border-t-[#C67A4A]" />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
              <p className="mb-2 text-stone-500">还没有课程</p>
              <p className="mb-4 text-sm text-stone-400">上传资料后点击"生成课程"即可创建</p>
              <Link
                href="/resources"
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm text-white transition hover:bg-stone-700"
              >
                前往资料库
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-stone-800">{course.title}</h2>
                      {course.summary ? (
                        <p className="mt-1 text-sm text-stone-500 line-clamp-2">{course.summary.slice(0, 200)}</p>
                      ) : null}
                      <div className="mt-3 flex items-center gap-3 text-xs text-stone-400">
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5">
                          {course.difficulty_level === "beginner" ? "初学" : course.difficulty_level === "advanced" ? "进阶" : "专家"}
                        </span>
                        <span>{course.section_count} 个章节</span>
                        <span>{new Date(course.created_at).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        href={`/courses/${course.id}`}
                        className="rounded-lg bg-[#C67A4A] px-4 py-2 text-sm text-white transition hover:bg-[#b06a3a]"
                      >
                        开始学习
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(course.id, course.title)}
                        className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-400 transition hover:bg-red-50 hover:text-red-500"
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
      </div>
    </MainShell>
  );
}
