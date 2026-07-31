import { create } from "zustand";
import type { UserRecord } from "../lib/api/authService";

interface AuthState {
  authenticated: boolean;
  currentUser: UserRecord | null;
  setAuthenticated: (authenticated: boolean) => void;
  setCurrentUser: (user: UserRecord | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: Boolean(window.localStorage.getItem("accessToken")),
  currentUser: null,
  setAuthenticated: (authenticated) => set({ authenticated }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  clearAuth: () => set({ authenticated: false, currentUser: null }),
}));
