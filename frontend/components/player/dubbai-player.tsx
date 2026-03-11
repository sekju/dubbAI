"use client";

import clsx from "clsx";
import React, { useEffect, useRef } from "react";

import { groupTranscriptWords } from "@/lib/transcript-rendering";
import type { TranscriptWord, TranscriptWordGroup } from "@/lib/types";
import {
  usePlayerStore,
  type SecondarySubtitleTrackSource,
  type SubtitleTrackSource
} from "@/store/use-player-store";

type DubbAIPlayerProps = {
  src: string;
  dubbingSrc?: string | null;
  transcriptWords: TranscriptWord[];
  onAutoplayNext?: () => void;
};

const densityOptions = [
  { value: "compact", label: "Compact" },
  { value: "balanced", label: "Balanced" },
  { value: "sentence", label: "Sentence" }
] as const;

const playbackRates = [1, 1.25, 1.5] as const;

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getTrackWords(
  cue: TranscriptWordGroup | undefined,
  track: SubtitleTrackSource | SecondarySubtitleTrackSource
) {
  if (!cue || track === "off") {
    return [];
  }

  return cue.words
    .map((word) => ({
      position: word.position,
      text: track === "translation" ? word.translatedText : word.originalText,
      keyword: word.keyword,
      startMs: word.startMs,
      endMs: word.endMs,
    }))
    .filter((word) => word.text.trim().length > 0);
}

export function DubbAIPlayer({
  src,
  dubbingSrc = null,
  transcriptWords,
  onAutoplayNext
}: DubbAIPlayerProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dubbingRef = useRef<HTMLAudioElement | null>(null);
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    density,
    primaryTrack,
    secondaryTrack,
    primaryTiktokMode,
    secondaryTiktokMode,
    currentTimeMs,
    durationMs,
    isPlaying,
    volume,
    playbackRate,
    autoplay,
    isFullscreen,
    overlayVisible,
    settingsOpen,
    setDensity,
    setPrimaryTrack,
    setSecondaryTrack,
    setCurrentTimeMs,
    setDurationMs,
    setIsPlaying,
    setVolume,
    setPlaybackRate,
    toggleAutoplay,
    swapTracks,
    togglePrimaryTiktokMode,
    toggleSecondaryTiktokMode,
    setIsFullscreen,
    setOverlayVisible,
    toggleSettingsOpen
  } = usePlayerStore();

  const originalGroups = groupTranscriptWords(transcriptWords, density, "original");
  const translationGroups = groupTranscriptWords(transcriptWords, density, "translation");
  const activePrimaryGroup =
    (primaryTrack === "translation" ? translationGroups : originalGroups).find(
      (group) => currentTimeMs >= group.startMs && currentTimeMs <= group.endMs
    ) ?? (primaryTrack === "translation" ? translationGroups[0] : originalGroups[0]);
  const activeSecondaryGroup =
    secondaryTrack === "off"
      ? undefined
      : (secondaryTrack === "translation" ? translationGroups : originalGroups).find(
            (group) => currentTimeMs >= group.startMs && currentTimeMs <= group.endMs
          ) ?? (secondaryTrack === "translation" ? translationGroups[0] : originalGroups[0]);
  const primaryWords = getTrackWords(activePrimaryGroup, primaryTrack);
  const secondaryWords = getTrackWords(activeSecondaryGroup, secondaryTrack);

  function renderTrackWords(
    trackWords: typeof primaryWords,
    trackId: "primary" | "secondary",
    fallback: string,
    tiktokEnabled: boolean
  ) {
    if (!trackWords.length) {
      return fallback;
    }

    return trackWords.map((word) => (
      <span
        className={clsx(
          "inline transition",
          word.keyword ? "text-aqua" : "",
          currentTimeMs >= word.startMs && currentTimeMs <= word.endMs
            ? "rounded-md bg-white px-1 text-ink"
            : "",
          tiktokEnabled && currentTimeMs >= word.startMs && currentTimeMs <= word.endMs
            ? "scale-[1.05] font-bold"
            : ""
        )}
        data-active={currentTimeMs >= word.startMs && currentTimeMs <= word.endMs ? "true" : "false"}
        data-keyword={word.keyword ? "true" : "false"}
        data-tiktok={tiktokEnabled ? "true" : "false"}
        data-testid={`subtitle-${trackId}-word-${word.position}`}
        key={`${trackId}-${word.position}`}
      >
        {word.text}
        {" "}
      </span>
    ));
  }

  function clearOverlayTimer() {
    if (hideOverlayTimerRef.current) {
      clearTimeout(hideOverlayTimerRef.current);
      hideOverlayTimerRef.current = null;
    }
  }

  function scheduleOverlayHide() {
    clearOverlayTimer();
    hideOverlayTimerRef.current = setTimeout(() => {
      setOverlayVisible(false);
    }, 2500);
  }

  function showOverlay() {
    setOverlayVisible(true);
    scheduleOverlayHide();
  }

  function syncDubbingTime() {
    const video = videoRef.current;
    const dubbing = dubbingRef.current;

    if (!video || !dubbing) {
      return;
    }

    if (Math.abs(dubbing.currentTime - video.currentTime) > 0.25) {
      dubbing.currentTime = video.currentTime;
    }
  }

  function seekBy(msDelta: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextTimeMs = Math.max(0, currentTimeMs + msDelta);
    video.currentTime = nextTimeMs / 1000;
    if (dubbingRef.current) {
      dubbingRef.current.currentTime = video.currentTime;
    }
    setCurrentTimeMs(nextTimeMs);
    showOverlay();
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (isPlaying) {
      video.pause();
      dubbingRef.current?.pause();
      setIsPlaying(false);
    } else {
      void video.play().catch(() => undefined);
      if (dubbingRef.current) {
        dubbingRef.current.currentTime = video.currentTime;
        void dubbingRef.current.play().catch(() => undefined);
      }
      setIsPlaying(true);
    }

    showOverlay();
  }

  async function toggleBrowserFullscreen() {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (document.fullscreenElement === container) {
      await document.exitFullscreen?.();
      return;
    }

    await container.requestFullscreen?.();
  }

  useEffect(() => {
    showOverlay();

    return () => {
      clearOverlayTimer();
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [setIsFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    const dubbing = dubbingRef.current;

    if (!video) {
      return;
    }

    video.volume = volume / 100;
    video.playbackRate = playbackRate;

    if (dubbing) {
      dubbing.volume = volume / 100;
      dubbing.playbackRate = playbackRate;
    }
  }, [playbackRate, volume]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      const seconds = Number.isFinite(video.duration) ? video.duration : 0;
      setDurationMs(Math.floor(seconds * 1000));
    };

    const handleTimeUpdate = () => {
      setCurrentTimeMs(Math.floor(video.currentTime * 1000));
      syncDubbingTime();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      showOverlay();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setOverlayVisible(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setOverlayVisible(true);
      if (autoplay) {
        onAutoplayNext?.();
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [autoplay, onAutoplayNext, setCurrentTimeMs, setDurationMs, setIsPlaying, setOverlayVisible]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === " " || key === "k") {
        event.preventDefault();
        togglePlayback();
        return;
      }
      if (key === "j") {
        seekBy(-15000);
        return;
      }
      if (key === "l") {
        seekBy(15000);
        return;
      }
      if (key === "arrowleft") {
        seekBy(-5000);
        return;
      }
      if (key === "arrowright") {
        seekBy(5000);
        return;
      }
      if (key === "arrowup") {
        setVolume(Math.min(volume + 5, 100));
        showOverlay();
        return;
      }
      if (key === "arrowdown") {
        setVolume(Math.max(volume - 5, 0));
        showOverlay();
        return;
      }
      if (key === "f") {
        void toggleBrowserFullscreen();
        showOverlay();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, setVolume, volume]);

  return (
    <section
      className={clsx(
        "overflow-hidden rounded-[2rem] border border-black/10 bg-[#0a1016] text-white shadow-[0_35px_80px_rgba(10,16,22,0.18)]",
        isFullscreen ? "ring-1 ring-aqua/35" : ""
      )}
      data-testid="player-frame"
      ref={containerRef}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-black">
        <video
          className="aspect-video w-full bg-black object-contain"
          onMouseMove={showOverlay}
          ref={videoRef}
          src={src}
        />
        {dubbingSrc ? <audio className="hidden" ref={dubbingRef} src={dubbingSrc} /> : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-24 pt-20 md:px-7">
          <p
            className="max-w-4xl text-[clamp(1.5rem,3vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em] text-[#f5f1e8]"
            data-testid="subtitle-primary"
          >
            {renderTrackWords(
              primaryWords,
              "primary",
              primaryTrack === "original" ? "Original subtitles" : "Translated subtitles will appear here",
              primaryTiktokMode
            )}
          </p>
          {secondaryTrack !== "off" ? (
            <p
              className="mt-2 max-w-3xl text-sm uppercase tracking-[0.26em] text-white/72 md:text-base"
              data-testid="subtitle-secondary"
            >
              {renderTrackWords(
                secondaryWords,
                "secondary",
                secondaryTrack === "original" ? "Original subtitles" : "Translated subtitles will appear here",
                secondaryTiktokMode
              )}
            </p>
          ) : null}
        </div>

        <div
          className={clsx(
            "absolute inset-x-0 bottom-0 transition-opacity duration-200",
            overlayVisible ? "opacity-100" : "opacity-0"
          )}
          data-state={overlayVisible ? "visible" : "hidden"}
          data-testid="player-overlay"
        >
          <div className="bg-gradient-to-t from-black via-black/88 to-transparent px-4 pb-4 pt-10 md:px-6">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-fog/70">
              <span>{originalGroups.length} cues</span>
              <span>{formatTimestamp(currentTimeMs)} / {formatTimestamp(durationMs)}</span>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <input
                aria-label="Timeline"
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-aqua"
                max={Math.max(durationMs, currentTimeMs, 1)}
                min={0}
                onChange={(event) => {
                  const nextTimeMs = Number(event.target.value);
                  if (videoRef.current) {
                    videoRef.current.currentTime = nextTimeMs / 1000;
                  }
                  setCurrentTimeMs(nextTimeMs);
                  showOverlay();
                }}
                type="range"
                value={Math.min(currentTimeMs, Math.max(durationMs, currentTimeMs, 1))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand"
                onClick={togglePlayback}
                type="button"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={() => seekBy(-15000)}
                type="button"
              >
                -15s
              </button>
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={() => seekBy(15000)}
                type="button"
              >
                +15s
              </button>
              <label className="flex items-center gap-2 text-sm text-fog/80">
                <span>Volume</span>
                <input
                  aria-label="Volume"
                  className="h-2 w-28 cursor-pointer appearance-none rounded-full bg-white/15 accent-ember"
                  max={100}
                  min={0}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  type="range"
                  value={volume}
                />
              </label>
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={() => {
                  void toggleBrowserFullscreen();
                  showOverlay();
                }}
                type="button"
              >
                Fullscreen
              </button>
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={toggleSettingsOpen}
                type="button"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen ? (
        <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua/80">Subtitles</p>
              <div className="space-y-2">
                <p className="text-sm text-fog/75">Primary track</p>
                <div className="flex flex-wrap gap-2">
                  {(["translation", "original"] as const).map((track) => (
                    <button
                      aria-label={`Primary ${track}`}
                      className={clsx(
                        "rounded-full border px-4 py-2 text-sm font-semibold transition",
                        primaryTrack === track
                          ? "border-aqua bg-aqua text-ink"
                          : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                      )}
                      key={`primary-${track}`}
                      onClick={() => setPrimaryTrack(track)}
                      type="button"
                    >
                      {track === "translation" ? "Translation" : "Original"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-fog/75">Secondary track</p>
                <div className="flex flex-wrap gap-2">
                  {(["original", "translation", "off"] as const).map((track) => (
                    <button
                      aria-label={`Secondary ${track}`}
                      className={clsx(
                        "rounded-full border px-4 py-2 text-sm font-semibold transition",
                        secondaryTrack === track
                          ? "border-white bg-white text-ink"
                          : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                      )}
                      key={`secondary-${track}`}
                      onClick={() => setSecondaryTrack(track)}
                      type="button"
                    >
                      {track === "off"
                        ? "Off"
                        : track === "translation"
                          ? "Translation"
                          : "Original"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-fog transition hover:bg-white/10 disabled:opacity-50"
                  disabled={secondaryTrack === "off"}
                  onClick={swapTracks}
                  type="button"
                >
                  Swap tracks
                </button>
                <button
                  aria-label="Primary tiktok"
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    primaryTiktokMode
                      ? "border-aqua bg-aqua text-ink"
                      : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                  )}
                  onClick={togglePrimaryTiktokMode}
                  type="button"
                >
                  Primary tiktok
                </button>
                <button
                  aria-label="Secondary tiktok"
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    secondaryTiktokMode
                      ? "border-white bg-white text-ink"
                      : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                  )}
                  onClick={toggleSecondaryTiktokMode}
                  type="button"
                >
                  Secondary tiktok
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {densityOptions.map((option) => (
                  <button
                    className={clsx(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      density === option.value
                        ? "border-ember bg-ember text-white"
                        : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                    )}
                    key={option.value}
                    onClick={() => setDensity(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua/80">Playback</p>
              <div className="flex flex-wrap gap-2">
                {playbackRates.map((rate) => (
                  <button
                    className={clsx(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      playbackRate === rate
                        ? "border-white bg-white text-ink"
                        : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                    )}
                    key={rate}
                    onClick={() => setPlaybackRate(rate)}
                    type="button"
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua/80">Queue</p>
              <button
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  autoplay
                    ? "border-aqua bg-aqua text-ink"
                    : "border-white/12 bg-white/5 text-fog hover:bg-white/10"
                )}
                onClick={toggleAutoplay}
                type="button"
              >
                Autoplay next
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
