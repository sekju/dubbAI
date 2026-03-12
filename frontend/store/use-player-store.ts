"use client";

import { create } from "zustand";

import type { SubtitleDensity } from "@/lib/types";

export type SubtitleTrackSource = "translation" | "original";
export type SecondarySubtitleTrackSource = SubtitleTrackSource | "off";

type PlayerState = {
  density: SubtitleDensity;
  primaryTrack: SubtitleTrackSource;
  secondaryTrack: SecondarySubtitleTrackSource;
  primaryTiktokMode: boolean;
  secondaryTiktokMode: boolean;
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
  setPrimaryTrack: (track: SubtitleTrackSource) => void;
  setSecondaryTrack: (track: SecondarySubtitleTrackSource) => void;
  setCurrentTimeMs: (timeMs: number) => void;
  setDurationMs: (timeMs: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleAutoplay: () => void;
  swapTracks: () => void;
  togglePrimaryTiktokMode: () => void;
  toggleSecondaryTiktokMode: () => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  setOverlayVisible: (visible: boolean) => void;
  toggleSettingsOpen: () => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  density: "balanced",
  primaryTrack: "translation",
  secondaryTrack: "original",
  primaryTiktokMode: false,
  secondaryTiktokMode: false,
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
  setPrimaryTrack: (primaryTrack) => set({ primaryTrack }),
  setSecondaryTrack: (secondaryTrack) => set({ secondaryTrack }),
  setCurrentTimeMs: (currentTimeMs) => set({ currentTimeMs }),
  setDurationMs: (durationMs) => set({ durationMs }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  toggleAutoplay: () => set((state) => ({ autoplay: !state.autoplay })),
  swapTracks: () =>
    set((state) => {
      if (state.secondaryTrack === "off") {
        return state;
      }

      return {
        primaryTrack: state.secondaryTrack,
        secondaryTrack: state.primaryTrack
      };
    }),
  togglePrimaryTiktokMode: () =>
    set((state) => ({ primaryTiktokMode: !state.primaryTiktokMode })),
  toggleSecondaryTiktokMode: () =>
    set((state) => ({ secondaryTiktokMode: !state.secondaryTiktokMode })),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  setOverlayVisible: (overlayVisible) => set({ overlayVisible }),
  toggleSettingsOpen: () => set((state) => ({ settingsOpen: !state.settingsOpen }))
}));
