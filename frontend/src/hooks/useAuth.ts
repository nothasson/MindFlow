"use client";

import { useState, useEffect, useCallback } from "react";
import { getMe, type AuthResponse } from "@/lib/api";

/** 用户信息类型 */
export type User = AuthResponse["user"];

/**
 * 登录状态 hook
 * - 自动从 localStorage 读取 token 并验证
 * - token 无效时自动清除
 * - 不强制登录，仅提供状态
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mindflow_token");
    if (!token) {
      setLoading(false);
      return;
    }
    // 用 GET /api/auth/me 验证 token 有效性
    getMe()
      .then(setUser)
      .catch(() => {
        // token 过期或无效，清除
        localStorage.removeItem("mindflow_token");
      })
      .finally(() => setLoading(false));
  }, []);

  /** 退出登录：清除 token 并刷新页面 */
  const logout = useCallback(() => {
    localStorage.removeItem("mindflow_token");
    setUser(null);
    window.location.reload();
  }, []);

  return {
    user,
    loading,
    isLoggedIn: !!user,
    logout,
  };
}
