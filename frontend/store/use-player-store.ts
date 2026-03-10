"use client";

import { create } from "zustand";

import type { SubtitleDensity } from "@/lib/types";

export type SubtitleMode = "translation" | "dual" | "original";

type PlayerState = {
  density: SubtitleDensity;
  subtitleMode: SubtitleMode;
  transcriptPanelOpen: boolean;
  karaokeEnabled: boolean;
  originalVolume: number;
  dubbingVolume: number;
  currentTimeMs: number;
  setDensity: (density: SubtitleDensity) => void;
  setSubtitleMode: (mode: SubtitleMode) => void;
  toggleTranscriptPanel: () => void;
  toggleKaraoke: () => void;
  setOriginalVolume: (volume: number) => void;
  setDubbingVolume: (volume: number) => void;
  setCurrentTimeMs: (timeMs: number) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  density: "balanced",
  subtitleMode: "dual",
  transcriptPanelOpen: true,
  karaokeEnabled: true,
  originalVolume: 40,
  dubbingVolume: 100,
  currentTimeMs: 0,
  setDensity: (density) => set({ density }),
  setSubtitleMode: (subtitleMode) => set({ subtitleMode }),
  toggleTranscriptPanel: () =>
    set((state) => ({ transcriptPanelOpen: !state.transcriptPanelOpen })),
  toggleKaraoke: () => set((state) => ({ karaokeEnabled: !state.karaokeEnabled })),
  setOriginalVolume: (originalVolume) => set({ originalVolume }),
  setDubbingVolume: (dubbingVolume) => set({ dubbingVolume }),
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs })
}));
