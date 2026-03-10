"use client";

import { create } from "zustand";

import type { TheaterQueueItem } from "@/lib/types";

type LoadQueueArgs = {
  playlistId: string;
  currentProjectId: string;
  items: TheaterQueueItem[];
};

type TheaterQueueState = {
  playlistId: string | null;
  items: TheaterQueueItem[];
  currentIndex: number;
  autoplay: boolean;
  loadQueue: (args: LoadQueueArgs) => void;
  selectIndex: (index: number) => void;
  goNext: () => void;
  goPrevious: () => void;
  toggleAutoplay: () => void;
};

export const useTheaterQueueStore = create<TheaterQueueState>((set) => ({
  playlistId: null,
  items: [],
  currentIndex: 0,
  autoplay: true,
  loadQueue: ({ playlistId, currentProjectId, items }) =>
    set({
      playlistId,
      items,
      currentIndex: Math.max(
        0,
        items.findIndex((item) => item.projectId === currentProjectId)
      )
    }),
  selectIndex: (currentIndex) => set({ currentIndex }),
  goNext: () =>
    set((state) => ({
      currentIndex: Math.min(state.currentIndex + 1, Math.max(0, state.items.length - 1))
    })),
  goPrevious: () =>
    set((state) => ({
      currentIndex: Math.max(state.currentIndex - 1, 0)
    })),
  toggleAutoplay: () =>
    set((state) => ({
      autoplay: !state.autoplay
    }))
}));
