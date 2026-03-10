"use client";

import { create } from "zustand";

type AuthState = {
  accessToken: string | null;
  email: string | null;
  setSession: (email: string, accessToken: string) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  email: null,
  setSession: (email, accessToken) => set({ email, accessToken }),
  clearSession: () => set({ email: null, accessToken: null })
}));
