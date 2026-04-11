import { create } from "zustand";
import type { User } from "../lib/types";
import * as api from "../lib/api";
import { getToken, removeToken, setToken } from "../lib/storage";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** 初始化：从 AsyncStorage 恢复登录态 */
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,

  init: async () => {
    try {
      const token = await getToken();
      if (token) {
        const user = await api.getMe();
        set({ user, token, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      await removeToken();
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (email, password) => {
    const res = await api.login(email, password);
    await setToken(res.token);
    set({ user: res.user, token: res.token });
  },

  register: async (email, password, name) => {
    const res = await api.register(email, password, name);
    await setToken(res.token);
    set({ user: res.user, token: res.token });
  },

  logout: async () => {
    await removeToken();
    set({ user: null, token: null });
  },
}));
