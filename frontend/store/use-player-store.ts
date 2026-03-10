"use client";

import { create } from "zustand";

import type { SubtitleDensity } from "@/lib/types";

export type SubtitleMode = "translation" | "dual" | "original";

type PlayerState = {
  density: SubtitleDensity;
  subtitleMode: SubtitleMode;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  autoplay: boolean;
  isFullscreen: boolean;
  overlayVisible: boolean;
  settingsOpen: boolean;
  setDensity: (density: SubtitleDensity) => void;
  setSubtitleMode: (mode: SubtitleMode) => void;
  setCurrentTimeMs: (timeMs: number) => void;
  setDurationMs: (timeMs: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleAutoplay: () => void;
  toggleFullscreen: () => void;
  setOverlayVisible: (visible: boolean) => void;
  toggleSettingsOpen: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  density: "balanced",
  subtitleMode: "dual",
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  volume: 80,
  playbackRate: 1,
  autoplay: true,
  isFullscreen: false,
  overlayVisible: true,
  settingsOpen: false,
  setDensity: (density) => set({ density }),
  setSubtitleMode: (subtitleMode) => set({ subtitleMode }),
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
  setDurationMs: (durationMs) => set({ durationMs }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  toggleAutoplay: () => set((state) => ({ autoplay: !state.autoplay })),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  toggleSettingsOpen: () => set((state) => ({ settingsOpen: !state.settingsOpen }))
}));
