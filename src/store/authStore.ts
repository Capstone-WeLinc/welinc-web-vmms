import { create } from 'zustand';
import type { UserRecord } from '../lib/api/authService';

type AuthState = {
  authenticated: boolean;
  currentUser: UserRecord | null;
  token: string | null;
  expiresAt: number | null;
  sessionExpiresAt: string | null;
  sessionAbsoluteExpiresAt: string | null;
  idleWarning: { cutoff: number; cannotExtend: boolean; busy: boolean; dismissed: boolean } | null;
  status: 'booting' | 'ready' | 'unavailable';
  setAuthenticated: (authenticated: boolean) => void;
  setCurrentUser: (user: UserRecord | null) => void;
  setSession: (token: string, expiresAt: number, user: UserRecord) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false,
  currentUser: null,
  token: null,
  expiresAt: null,
  sessionExpiresAt: null,
  sessionAbsoluteExpiresAt: null,
  idleWarning: null,
  status: 'booting',
  setAuthenticated: (authenticated) => set({ authenticated }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  setSession: (token, expiresAt, currentUser) =>
    set({ token, expiresAt, currentUser, authenticated: true, status: 'ready' }),
  clearAuth: () =>
    set({
      authenticated: false,
      currentUser: null,
      token: null,
      expiresAt: null,
      sessionExpiresAt: null,
      sessionAbsoluteExpiresAt: null,
      idleWarning: null,
    }),
}));
