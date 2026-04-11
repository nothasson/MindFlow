"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await register(email, password, displayName);
        localStorage.setItem("mindflow_token", res.token);
      } else {
        const res = await login(email, password);
        localStorage.setItem("mindflow_token", res.token);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / 标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-stone-800">MindFlow</h1>
          <p className="mt-2 text-sm text-stone-500">
            {isRegister ? "创建账号，开始你的学习之旅" : "登录你的学习空间"}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-stone-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
              />
            </div>

            {isRegister && (
              <div>
                <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-stone-700">
                  昵称
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="你的昵称（可选）"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
                密码
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "至少 6 位" : "输入密码"}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-[#C67A4A] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#b06a3a] disabled:bg-stone-400"
          >
            {loading ? "请稍候..." : isRegister ? "注册" : "登录"}
          </button>
        </form>

        {/* 切换登录/注册 */}
        <p className="mt-6 text-center text-sm text-stone-500">
          {isRegister ? "已有账号？" : "没有账号？"}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="ml-1 font-medium text-[#C67A4A] hover:text-[#b06a3a]"
          >
            {isRegister ? "去登录" : "注册"}
          </button>
        </p>
      </div>
    </div>
  );
}
