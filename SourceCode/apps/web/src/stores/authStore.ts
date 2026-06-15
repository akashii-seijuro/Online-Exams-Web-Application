import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthResponse, AuthUser } from "../types/auth";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (auth: AuthResponse) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (auth) =>
        set({
          user: auth.user,
          accessToken: auth.accessToken,
          isAuthenticated: true
        }),
      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false
        })
    }),
    {
      name: "classpulse-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
