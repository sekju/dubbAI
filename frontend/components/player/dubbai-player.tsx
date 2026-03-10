"use client";

import clsx from "clsx";
import React, { useEffect, useMemo, useRef } from "react";

import type { TranscriptCue } from "@/lib/types";
import { usePlayerStore, type SubtitleMode } from "@/store/use-player-store";

type DubbAIPlayerProps = {
  src: string;
  dubbingSrc?: string | null;
  cues: TranscriptCue[];
};

const densityOptions = [
  { value: "compact", label: "Compact", description: "3 words" },
  { value: "balanced", label: "Balanced", description: "6 words" },
  { value: "sentence", label: "Sentence", description: "Full line" }
] as const;

const subtitleModes: Array<{ value: SubtitleMode; label: string }> = [
  { value: "dual", label: "Dual" },
  { value: "translation", label: "Translation" },
  { value: "original", label: "Original" }
];

function getActiveCue(cues: TranscriptCue[], currentTimeMs: number): TranscriptCue | undefined {
  return cues.find((cue) => currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs) ?? cues[0];
}

function getWordLimit(density: "compact" | "balanced" | "sentence"): number {
  if (density === "compact") {
    return 3;
  }
  if (density === "balanced") {
    return 6;
  }
  return Number.POSITIVE_INFINITY;
}

function truncateSubtitle(text: string, density: "compact" | "balanced" | "sentence"): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return text;
  }

  const limit = getWordLimit(density);
  if (limit === Number.POSITIVE_INFINITY || words.length <= limit) {
    return words.join(" ");
  }

  return words.slice(0, limit).join(" ");
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function buildKaraokeWords(cue: TranscriptCue | undefined) {
  if (!cue) {
    return [];
  }

  if (cue.words.length > 0) {
    return cue.words;
  }

  const translatedWords = cue.translatedText.trim().split(/\s+/).filter(Boolean);
  return translatedWords.map((word, index) => ({
    text: word,
    startMs: cue.startMs + index * 120,
    endMs: cue.startMs + index * 120 + 100
  }));
}

export function DubbAIPlayer({ src, dubbingSrc = null, cues }: DubbAIPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dubbingRef = useRef<HTMLAudioElement | null>(null);
  const {
    density,
    subtitleMode,
    transcriptPanelOpen,
    karaokeEnabled,
    originalVolume,
    dubbingVolume,
    currentTimeMs,
    setDensity,
    setSubtitleMode,
    toggleTranscriptPanel,
    toggleKaraoke,
    setOriginalVolume,
    setDubbingVolume,
    setCurrentTimeMs
  } = usePlayerStore();

  const activeCue = getActiveCue(cues, currentTimeMs);
  const translatedLine = truncateSubtitle(
    activeCue?.translatedText ?? "Translated subtitles will appear here",
    density
  );
  const originalLine = truncateSubtitle(activeCue?.originalText ?? "Original subtitles", density);
  const karaokeWords = useMemo(() => buildKaraokeWords(activeCue), [activeCue]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = originalVolume / 100;
    }
    if (dubbingRef.current) {
      dubbingRef.current.volume = dubbingVolume / 100;
    }
  }, [dubbingVolume, originalVolume]);

  useEffect(() => {
    const video = videoRef.current;
    const dubbing = dubbingRef.current;

    if (!video) {
      return;
    }

    const syncAudioClock = () => {
      if (!dubbing) {
        return;
      }

      if (Math.abs(dubbing.currentTime - video.currentTime) > 0.25) {
        dubbing.currentTime = video.currentTime;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTimeMs(Math.floor(video.currentTime * 1000));
      syncAudioClock();
    };

    const handlePlay = () => {
      if (!dubbing) {
        return;
      }

      dubbing.currentTime = video.currentTime;
      void dubbing.play().catch(() => undefined);
    };

    const handlePause = () => {
      dubbing?.pause();
    };

    const handleSeeking = () => {
      syncAudioClock();
      setCurrentTimeMs(Math.floor(video.currentTime * 1000));
    };

    const handleRateChange = () => {
      if (dubbing) {
        dubbing.playbackRate = video.playbackRate;
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("ratechange", handleRateChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("ratechange", handleRateChange);
    };
  }, [dubbingSrc, setCurrentTimeMs]);

  function jumpToCue(startMs: number) {
    const targetSeconds = startMs / 1000;
    if (videoRef.current) {
      videoRef.current.currentTime = targetSeconds;
    }
    if (dubbingRef.current) {
      dubbingRef.current.currentTime = targetSeconds;
    }
    setCurrentTimeMs(startMs);
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-[#0a1016] text-white shadow-[0_35px_80px_rgba(10,16,22,0.18)]">
      <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(8,13,18,0.98),rgba(22,37,52,0.98))] px-5 py-4 xl:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.38em] text-aqua/90">Cinema Workspace</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-fog/80">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {cues.length} subtitle segments
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatTimestamp(currentTimeMs)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {transcriptPanelOpen ? "Transcript panel on" : "Transcript panel off"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {subtitleModes.map((option) => (
              <button
                aria-pressed={subtitleMode === option.value}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  subtitleMode === option.value
                    ? "border-aqua bg-aqua text-ink"
                    : "border-white/12 bg-white/5 text-fog hover:border-white/25 hover:bg-white/10"
                )}
                key={option.value}
                onClick={() => setSubtitleMode(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            <button
              aria-pressed={karaokeEnabled}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                karaokeEnabled
                  ? "border-white/20 bg-white/12 text-white"
                  : "border-white/12 bg-transparent text-fog"
              )}
              onClick={toggleKaraoke}
              type="button"
            >
              Karaoke
            </button>
            <button
              aria-pressed={transcriptPanelOpen}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                transcriptPanelOpen
                  ? "border-white/20 bg-white/12 text-white"
                  : "border-white/12 bg-transparent text-fog"
              )}
              onClick={toggleTranscriptPanel}
              type="button"
            >
              Transcript
            </button>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          "grid gap-6 p-4 xl:p-6",
          transcriptPanelOpen ? "xl:grid-cols-[minmax(0,1.65fr)_360px]" : "xl:grid-cols-1"
        )}
      >
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
            <video
              className="aspect-video w-full bg-black object-contain"
              controls
              ref={videoRef}
              src={src}
            />
            {dubbingSrc ? <audio className="hidden" ref={dubbingRef} src={dubbingSrc} /> : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-5 pb-5 pt-20 md:px-7 md:pb-7">
              {subtitleMode !== "original" ? (
                <p className="max-w-4xl text-[clamp(1.5rem,3vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em] text-[#f5f1e8] drop-shadow-[0_6px_30px_rgba(0,0,0,0.9)]">
                  {translatedLine}
                </p>
              ) : null}
              {subtitleMode !== "translation" ? (
                <p className="mt-2 max-w-3xl text-sm uppercase tracking-[0.26em] text-white/72 md:text-base">
                  {originalLine}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-aqua/80">Subtitle density</p>
                  <h2 className="text-xl font-semibold text-[#f5f1e8]">Readable on screen</h2>
                </div>
                <p className="text-sm text-fog/70">Buttons now change rendered lines.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {densityOptions.map((option) => (
                  <button
                    aria-pressed={density === option.value}
                    className={clsx(
                      "rounded-[1.25rem] border px-4 py-3 text-left transition",
                      density === option.value
                        ? "border-aqua bg-aqua/90 text-ink"
                        : "border-white/10 bg-black/20 text-white hover:border-white/25 hover:bg-white/10"
                    )}
                    key={option.value}
                    onClick={() => setDensity(option.value)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs opacity-75">{option.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-aqua/80">Live mix</p>
                <h2 className="text-xl font-semibold text-[#f5f1e8]">Audio control</h2>
              </div>

              <div className="space-y-4">
                <label className="block space-y-2 text-sm text-fog">
                  <div className="flex items-center justify-between">
                    <span>Original volume</span>
                    <span className="text-white">{originalVolume}%</span>
                  </div>
                  <input
                    aria-label="Original volume"
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-aqua"
                    max={100}
                    min={0}
                    onChange={(event) => setOriginalVolume(Number(event.target.value))}
                    type="range"
                    value={originalVolume}
                  />
                </label>

                <label className="block space-y-2 text-sm text-fog">
                  <div className="flex items-center justify-between">
                    <span>Dubbing volume</span>
                    <span className="text-white">{dubbingVolume}%</span>
                  </div>
                  <input
                    aria-label="Dubbing volume"
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-ember"
                    max={100}
                    min={0}
                    onChange={(event) => setDubbingVolume(Number(event.target.value))}
                    type="range"
                    value={dubbingVolume}
                  />
                </label>
              </div>
            </section>
          </div>

          {karaokeEnabled ? (
            <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-aqua/80">Karaoke</p>
                  <h2 className="text-xl font-semibold text-[#f5f1e8]">Live word pulse</h2>
                </div>
                <span className="text-sm text-fog/70">
                  {activeCue ? `${formatTimestamp(activeCue.startMs)} - ${formatTimestamp(activeCue.endMs)}` : "No cue"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {karaokeWords.length > 0 ? (
                  karaokeWords.map((word) => {
                    const isActiveWord =
                      currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;

                    return (
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1.5 text-sm font-medium transition",
                          isActiveWord
                            ? "bg-aqua text-ink shadow-[0_0_20px_rgba(82,209,198,0.4)]"
                            : "bg-white/8 text-white/82"
                        )}
                        key={`${word.text}-${word.startMs}`}
                      >
                        {word.text}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm text-fog/70">No active cue</span>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {transcriptPanelOpen ? (
          <aside className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4">
            <div className="mb-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-aqua/80">Transcript panel</p>
              <h2 className="text-2xl font-semibold text-[#f5f1e8]">Scene navigator</h2>
              <p className="text-sm leading-6 text-fog/70">
                Read transcript without covering the frame. Click any segment to jump.
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {cues.map((cue) => {
                const isActive = cue.id === activeCue?.id;
                return (
                  <button
                    className={clsx(
                      "block w-full rounded-[1.25rem] border p-4 text-left transition",
                      isActive
                        ? "border-aqua bg-aqua/12 shadow-[0_10px_30px_rgba(82,209,198,0.12)]"
                        : "border-white/10 bg-black/18 hover:border-white/25 hover:bg-white/10"
                    )}
                    key={cue.id}
                    onClick={() => jumpToCue(cue.startMs)}
                    type="button"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-fog/70">
                      <span>{cue.speaker}</span>
                      <span>{formatTimestamp(cue.startMs)}</span>
                    </div>
                    <p className="text-base font-semibold text-[#f5f1e8]">
                      {cue.translatedText}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-fog/72">{cue.originalText}</p>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
