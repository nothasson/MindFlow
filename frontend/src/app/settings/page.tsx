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

export default function SettingsPage() {
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  return (
    <MainShell>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-stone-800">设置</h1>
        <p className="mt-1 text-sm text-stone-500">管理 AI 模型提供方和系统偏好</p>

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
              {success ? (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </MainShell>
  );
}
