"use client";

import { useCallback, useEffect, useState } from "react";
import { MainShell } from "@/components/layout/MainShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface ProviderInfo {
  id: string;
  name: string;
  model: string;
}

interface ProviderSettings {
  active: string;
  providers: ProviderInfo[];
}

interface ExamPlan {
  id: string;
  title: string;
  exam_date: string;
  concepts: string[];
  acceleration_factor: number;
  active: boolean;
  created_at: string;
}

interface KnowledgeConcept {
  name: string;
  confidence: number;
}

// 教学风格选项定义
const TEACHING_STYLES = [
  { id: "socratic", label: "苏格拉底式", desc: "引导提问，启发独立思考（默认）" },
  { id: "lecture", label: "深入原理", desc: "从底层原理讲起，系统讲解" },
  { id: "analogy", label: "通俗比喻", desc: "用生活比喻解释抽象概念" },
] as const;

const LS_KEY_STYLE = "mindflow_teaching_style";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 教学风格状态
  const [teachingStyle, setTeachingStyle] = useState<string>("socratic");

  // 考试计划状态
  const [examPlans, setExamPlans] = useState<ExamPlan[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examConcepts, setExamConcepts] = useState<string[]>([]);
  const [allConcepts, setAllConcepts] = useState<KnowledgeConcept[]>([]);
  const [examCreating, setExamCreating] = useState(false);

  // 初始化时从 localStorage 读取教学风格
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(LS_KEY_STYLE);
      if (saved) {
        setTeachingStyle(saved);
      }
    }
  }, []);

  const handleStyleChange = (styleId: string) => {
    setTeachingStyle(styleId);
    localStorage.setItem(LS_KEY_STYLE, styleId);
    setSuccess("教学风格已更新");
    setTimeout(() => setSuccess(null), 3000);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/provider`);
      if (!res.ok) throw new Error("获取设置失败");
      const data: ProviderSettings = await res.json();
      setSettings(data);
      setError(null);
    } catch {
      setError("无法连接后端服务");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 加载考试计划和知识点列表
  const fetchExamPlans = useCallback(async () => {
    setExamLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/exam-plans`);
      if (!res.ok) throw new Error("获取考试计划失败");
      const data = await res.json();
      setExamPlans(data.plans ?? []);
    } catch {
      // 静默失败
    } finally {
      setExamLoading(false);
    }
  }, []);

  const fetchConcepts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/knowledge/graph`);
      if (!res.ok) return;
      const data = await res.json();
      const concepts: KnowledgeConcept[] = (data.nodes ?? []).map(
        (n: { name: string; confidence?: number }) => ({
          name: n.name,
          confidence: n.confidence ?? 0,
        })
      );
      setAllConcepts(concepts);
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchExamPlans();
    fetchConcepts();
  }, [fetchExamPlans, fetchConcepts]);

  const handleSwitch = async (providerId: string) => {
    if (!settings || providerId === settings.active) return;
    setSwitching(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/provider`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "切换失败");
      }
      setSettings((prev) => (prev ? { ...prev, active: providerId } : prev));
      const name = settings.providers.find((p) => p.id === providerId)?.name ?? providerId;
      setSuccess(`已切换到 ${name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换失败");
    } finally {
      setSwitching(false);
    }
  };

  // 创建考试计划
  const handleCreateExam = async () => {
    if (!examTitle || !examDate) return;
    setExamCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/exam-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examTitle,
          exam_date: examDate,
          concepts: examConcepts,
          acceleration_factor: 1.5,
        }),
      });
      if (!res.ok) throw new Error("创建失败");
      setExamTitle("");
      setExamDate("");
      setExamConcepts([]);
      fetchExamPlans();
      setSuccess("考试计划已创建");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建考试计划失败");
    } finally {
      setExamCreating(false);
    }
  };

  // 删除考试计划
  const handleDeleteExam = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/exam-plans/${id}`, { method: "DELETE" });
      fetchExamPlans();
    } catch {
      // 静默失败
    }
  };

  // 切换知识点选中状态
  const toggleConcept = (name: string) => {
    setExamConcepts((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  // 计算距考试天数
  const daysUntil = (dateStr: string) => {
    const examDay = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDay.setHours(0, 0, 0, 0);
    return Math.ceil((examDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <MainShell>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-stone-800">设置</h1>
        <p className="mt-1 text-sm text-stone-500">管理 AI 模型提供方和系统偏好</p>

        {/* 考试计划 */}
        <div className="mt-10">
          <h2 className="text-lg font-medium text-stone-700">考试计划</h2>
          <p className="mt-1 text-sm text-stone-500">
            设置考试日期，系统会加速相关知识点的复习频率。
          </p>

          {/* 创建表单 */}
          <div className="mt-6 rounded-xl border-2 border-stone-200 bg-white p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  考试名称
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="例如：期中考试"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  考试日期
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  关联知识点
                </label>
                {allConcepts.length === 0 ? (
                  <p className="text-sm text-stone-400">暂无知识点，先去学习一些内容</p>
                ) : (
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                    {allConcepts.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => toggleConcept(c.name)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          examConcepts.includes(c.name)
                            ? "border-[#C67A4A] bg-[#C67A4A]/10 text-[#C67A4A]"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleCreateExam}
                disabled={!examTitle || !examDate || examCreating}
                className="rounded-lg bg-[#C67A4A] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#b06a3a] disabled:bg-stone-400"
              >
                {examCreating ? "创建中..." : "创建考试计划"}
              </button>
            </div>
          </div>

          {/* 已有的考试计划列表 */}
          {examLoading ? (
            <div className="mt-4 text-sm text-stone-400">加载中...</div>
          ) : examPlans.length > 0 ? (
            <div className="mt-4 space-y-3">
              {examPlans.map((plan) => {
                const days = daysUntil(plan.exam_date);
                return (
                  <div
                    key={plan.id}
                    className="rounded-xl border-2 border-stone-200 bg-white px-5 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-800">{plan.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              days <= 7
                                ? "bg-red-100 text-red-700"
                                : days <= 30
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {days > 0 ? `${days} 天后` : days === 0 ? "今天" : "已过期"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          {new Date(plan.exam_date).toLocaleDateString("zh-CN")}
                          {plan.concepts.length > 0 &&
                            ` · ${plan.concepts.length} 个知识点`}
                        </p>
                        {plan.concepts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {plan.concepts.slice(0, 5).map((c) => (
                              <span
                                key={c}
                                className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600"
                              >
                                {c}
                              </span>
                            ))}
                            {plan.concepts.length > 5 && (
                              <span className="text-[11px] text-stone-400">
                                +{plan.concepts.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteExam(plan.id)}
                        className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        title="删除"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-400">暂无考试计划</p>
          )}
        </div>

        {/* 教学风格设置 */}
        <div className="mt-10">
          <h2 className="text-lg font-medium text-stone-700">教学风格</h2>
          <p className="mt-1 text-sm text-stone-500">
            选择你偏好的教学方式。切换后立即在下次对话中生效。
          </p>

          <div className="mt-6 space-y-3">
            {TEACHING_STYLES.map((style) => {
              const isActive = style.id === teachingStyle;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleStyleChange(style.id)}
                  className={`w-full rounded-xl border-2 px-5 py-4 text-left transition ${
                    isActive
                      ? "border-[#C67A4A] bg-[#C67A4A]/5"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-800">{style.label}</span>
                        {isActive ? (
                          <span className="rounded-full bg-[#C67A4A]/10 px-2 py-0.5 text-[11px] font-medium text-[#C67A4A]">
                            当前使用
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-stone-500">{style.desc}</p>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        isActive ? "border-[#C67A4A] bg-[#C67A4A]" : "border-stone-300"
                      }`}
                    >
                      {isActive ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 模型提供方设置 */}
        <div className="mt-10">
          <h2 className="text-lg font-medium text-stone-700">模型提供方</h2>
          <p className="mt-1 text-sm text-stone-500">
            选择用于对话的 AI 模型。切换后立即生效，所有功能都会使用新的模型。
          </p>

          {loading ? (
            <div className="mt-6 text-sm text-stone-400">加载中...</div>
          ) : error && !settings ? (
            <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : settings ? (
            <div className="mt-6 space-y-3">
              {settings.providers.map((provider) => {
                const isActive = provider.id === settings.active;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    disabled={switching}
                    onClick={() => handleSwitch(provider.id)}
                    className={`w-full rounded-xl border-2 px-5 py-4 text-left transition ${
                      isActive
                        ? "border-[#C67A4A] bg-[#C67A4A]/5"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    } ${switching ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-800">{provider.name}</span>
                          {isActive ? (
                            <span className="rounded-full bg-[#C67A4A]/10 px-2 py-0.5 text-[11px] font-medium text-[#C67A4A]">
                              当前使用
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-stone-500">模型: {provider.model}</p>
                      </div>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          isActive ? "border-[#C67A4A] bg-[#C67A4A]" : "border-stone-300"
                        }`}
                      >
                        {isActive ? (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}

              {error ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 全局成功/错误提示 */}
        {success ? (
          <div className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
        ) : null}
      </div>
    </MainShell>
  );
}
