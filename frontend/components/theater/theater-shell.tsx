"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import type { JobStatus, PipelineStageStatus, ProjectSummary, TheaterQueue } from "@/lib/types";
import {
  fetchJob,
  fetchProject,
  resolveMediaUrl,
  startProjectTranscription,
  startProjectTranslation
} from "@/lib/api";
import { usePlayerStore } from "@/store/use-player-store";
import { useTheaterQueueStore } from "@/store/use-theater-queue-store";

import { TheaterPlaylistDrawer } from "./theater-playlist-drawer";

type TheaterShellProps = {
  currentProjectId: string;
  fullscreen?: boolean;
  onNavigate?: (projectId: string) => void;
  project: ProjectSummary;
  queue: TheaterQueue;
};

type PipelineAction =
  | {
      buttonLabel: string;
      description: string;
      kind: "transcribe" | "translate";
      statusLabel: string;
      title: string;
    }
  | {
      buttonLabel?: never;
      description: string;
      kind?: never;
      statusLabel: string;
      title: string;
    };

function getStageStatus(status?: PipelineStageStatus): PipelineStageStatus {
  return status ?? "not_started";
}

function getStageTone(status: PipelineStageStatus) {
  switch (status) {
    case "ready":
      return "border-aqua/35 bg-aqua/12 text-white";
    case "failed":
      return "border-red-400/35 bg-red-500/12 text-white";
    case "queued":
    case "in_progress":
      return "border-amber-300/35 bg-amber-400/12 text-white";
    default:
      return "border-white/10 bg-white/5 text-fog/80";
  }
}

function getStageLabel(status: PipelineStageStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "queued":
      return "Queued";
    case "in_progress":
      return "Active";
    default:
      return "Pending";
  }
}

function derivePipelineAction(project: ProjectSummary): PipelineAction | null {
  const transcriptStatus = getStageStatus(project.transcriptStatus);
  const translationStatus = getStageStatus(project.translationStatus);

  if (transcriptStatus === "not_started") {
    return {
      kind: "transcribe",
      title: "Transcript missing",
      statusLabel: "Transcript pending",
      description: "Start transcription first. Theater unlocks after the subtitle timeline is generated.",
      buttonLabel: "Start transcription"
    };
  }

  if (transcriptStatus === "failed") {
    return {
      kind: "transcribe",
      title: "Transcript failed",
      statusLabel: "Transcript failed",
      description: "Retry transcription to rebuild the subtitle timeline before translation and review.",
      buttonLabel: "Retry transcription"
    };
  }

  if (transcriptStatus === "queued" || transcriptStatus === "in_progress") {
    return {
      title: "Transcription queued",
      statusLabel: transcriptStatus === "queued" ? "Transcription queued" : "Transcription running",
      description: "The subtitle timeline is on its way. Refresh after the job completes to enter viewing mode."
    };
  }

  if (translationStatus === "not_started") {
    return {
      kind: "translate",
      title: "Translation missing",
      statusLabel: "Translation pending",
      description: "Original transcript is ready. Start translation to unlock the bilingual Theater view.",
      buttonLabel: "Start translation"
    };
  }

  if (translationStatus === "failed") {
    return {
      kind: "translate",
      title: "Translation failed",
      statusLabel: "Translation failed",
      description: "Retry translation to prepare the secondary subtitle track before entering Theater mode.",
      buttonLabel: "Retry translation"
    };
  }

  if (translationStatus === "queued" || translationStatus === "in_progress") {
    return {
      title: "Translation queued",
      statusLabel: translationStatus === "queued" ? "Translation queued" : "Translation running",
      description: "Translation is still processing. Theater playback opens automatically once both text tracks are ready."
    };
  }

  return null;
}

function hasPlayableTranscript(project: ProjectSummary): boolean {
  return project.transcriptWords.length > 0;
}

function hasPlayableTranslation(project: ProjectSummary): boolean {
  return project.transcriptWords.some((word) => word.translatedText.trim().length > 0);
}

function isTerminalJobState(state: JobStatus["state"]): boolean {
  return state === "success" || state === "failure";
}

function getJobLabel(job: JobStatus): string {
  if (job.queue.includes("translate")) {
    return "Translation";
  }
  if (job.queue.includes("transcribe")) {
    return "Transcription";
  }
  return "Processing";
}

function formatElapsedJobTime(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(totalSeconds, 0) / 60);
  const seconds = Math.max(totalSeconds, 0) % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function TheaterShell({
  currentProjectId,
  fullscreen = false,
  onNavigate,
  project,
  queue
}: TheaterShellProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectState, setProjectState] = useState(project);
  const [activeJob, setActiveJob] = useState<JobStatus | null>(project.activeJob ?? null);
  const [jobElapsedSeconds, setJobElapsedSeconds] = useState(0);
  const [pendingAction, setPendingAction] = useState<"transcribe" | "translate" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobElapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedJobIdRef = useRef<string | null>(project.activeJob?.jobId ?? null);
  const jobStartTimeRef = useRef<number | null>(project.activeJob ? Date.now() : null);
  const playerIsFullscreen = usePlayerStore((state) => state.isFullscreen);
  const { autoplay, currentIndex, items, loadQueue, goNext } = useTheaterQueueStore();
  const sourceUrl = resolveMediaUrl(projectState.sourceUrl);
  const transcriptStatus = getStageStatus(projectState.transcriptStatus);
  const translationStatus = getStageStatus(projectState.translationStatus);
  const dubbingStatus = getStageStatus(projectState.dubbingStatus);
  const pipelineAction = derivePipelineAction(projectState);
  const shellFullscreen = fullscreen || playerIsFullscreen;
  const activeStageQueue = activeJob?.queue ?? "";
  const canOpenPlayer =
    Boolean(sourceUrl) &&
    transcriptStatus === "ready" &&
    translationStatus === "ready" &&
    hasPlayableTranscript(projectState) &&
    hasPlayableTranslation(projectState);

  useEffect(() => {
    setProjectState(project);
    setActiveJob(project.activeJob ?? null);
    trackedJobIdRef.current = project.activeJob?.jobId ?? null;
    jobStartTimeRef.current = project.activeJob ? Date.now() : null;
    setJobElapsedSeconds(0);
    setPendingAction(null);
    setActionError(null);
  }, [project]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
      if (jobElapsedTimerRef.current) {
        clearInterval(jobElapsedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (shellFullscreen) {
      setDrawerOpen(false);
    }
  }, [shellFullscreen]);

  useEffect(() => {
    loadQueue({
      playlistId: queue.playlistId,
      currentProjectId,
      items: queue.items
    });
  }, [currentProjectId, loadQueue, queue]);

  useEffect(() => {
    if (!activeJob || isTerminalJobState(activeJob.state)) {
      if (jobElapsedTimerRef.current) {
        clearInterval(jobElapsedTimerRef.current);
        jobElapsedTimerRef.current = null;
      }
      trackedJobIdRef.current = null;
      jobStartTimeRef.current = null;
      setJobElapsedSeconds(0);
      return;
    }

    if (trackedJobIdRef.current !== activeJob.jobId) {
      trackedJobIdRef.current = activeJob.jobId;
      jobStartTimeRef.current = Date.now();
      setJobElapsedSeconds(0);
    }

    const updateElapsed = () => {
      if (jobStartTimeRef.current === null) {
        setJobElapsedSeconds(0);
        return;
      }

      setJobElapsedSeconds(Math.floor((Date.now() - jobStartTimeRef.current) / 1000));
    };

    updateElapsed();
    jobElapsedTimerRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (jobElapsedTimerRef.current) {
        clearInterval(jobElapsedTimerRef.current);
        jobElapsedTimerRef.current = null;
      }
    };
  }, [activeJob]);

  useEffect(() => {
    if (!activeJob || isTerminalJobState(activeJob.state)) {
      return;
    }

    let cancelled = false;
    const trackedJobId = activeJob.jobId;

    async function pollPipeline() {
      try {
        const [nextJob, nextProject] = await Promise.all([
          fetchJob(trackedJobId),
          fetchProject(currentProjectId)
        ]);

        if (cancelled) {
          return;
        }

        setProjectState(nextProject);

        if (isTerminalJobState(nextJob.state)) {
          setActiveJob(null);
          return;
        }

        setActiveJob(nextJob);
        pollTimerRef.current = setTimeout(() => {
          void pollPipeline();
        }, 1500);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setActionError(error instanceof Error ? error.message : "Failed to refresh pipeline progress");
        pollTimerRef.current = setTimeout(() => {
          void pollPipeline();
        }, 2500);
      }
    }

    pollTimerRef.current = setTimeout(() => {
      void pollPipeline();
    }, 1500);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [activeJob, currentProjectId]);

  function navigateToProject(projectId: string) {
    if (onNavigate) {
      onNavigate(projectId);
      return;
    }

    router.push(`/theater/${queue.playlistId}/${projectId}`);
  }

  function handleAutoplayNext() {
    if (!autoplay || currentIndex >= items.length - 1) {
      return;
    }

    goNext();
    navigateToProject(items[currentIndex + 1].projectId);
  }

  async function handlePipelineAction(action: Exclude<PipelineAction["kind"], undefined>) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action);
    setActionError(null);

    try {
      if (action === "transcribe") {
        const job = await startProjectTranscription(projectState.id);
        setActiveJob(job);
        setProjectState((current) => ({
          ...current,
          status: "transcription_queued",
          transcriptStatus: "queued",
          activeJob: job
        }));
        return;
      }

      const job = await startProjectTranslation(projectState.id);
      setActiveJob(job);
      setProjectState((current) => ({
        ...current,
        status: "translation_queued",
        translationStatus: "queued",
        activeJob: job
      }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Pipeline action failed");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main
      className="min-h-screen bg-[#0a1016] px-5 py-6 text-white lg:px-8"
      data-fullscreen={shellFullscreen ? "true" : "false"}
      data-testid="theater-shell"
    >
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <header className="rounded-[1.8rem] border border-white/10 bg-white/5 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-aqua/80">Theater</p>
                <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-sand">
                  {projectState.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-fog/75">
                  <span>Playlist: {queue.playlistName}</span>
                  <span className="h-1 w-1 rounded-full bg-white/25" />
                  <span>
                    {(projectState.sourceLanguage ?? "--").toUpperCase()} -&gt; {(projectState.targetLanguage ?? "--").toUpperCase()}
                  </span>
                </div>
              </div>

              {!shellFullscreen ? (
                <div className="flex flex-wrap gap-3 text-sm">
                  <button
                    className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
                    onClick={() => setDrawerOpen((value) => !value)}
                    type="button"
                  >
                    Playlist
                  </button>
                  <Link
                    className="rounded-full bg-white px-4 py-2 font-semibold text-ink transition hover:bg-sand"
                    href="/library"
                  >
                    Back to Library
                  </Link>
                </div>
              ) : null}
            </div>

            <section className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-aqua/80">Pipeline stages</p>
                  <p className="mt-2 text-sm text-fog/70">
                    Source, transcript, translation, then dubbing. Each stage tells you what is ready
                    and what still needs action.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-fog/70">
                  {projectState.status}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {[
                  {
                    label: "Source",
                    detail: sourceUrl ? "Media ready" : "Missing media",
                    status: sourceUrl ? "ready" : "failed"
                  },
                  {
                    label: "Transcript",
                    detail:
                      activeStageQueue.includes("transcribe") && activeJob
                        ? `Live progress: ${activeJob.progress}% complete`
                        : transcriptStatus === "ready"
                          ? `${projectState.transcriptWords.length} words ready`
                          : "Build subtitle timeline",
                    status: transcriptStatus
                  },
                  {
                    label: "Translation",
                    detail:
                      activeStageQueue.includes("translate") && activeJob
                        ? `Live progress: ${activeJob.progress}% complete`
                        : translationStatus === "ready"
                          ? "Secondary track ready"
                          : "Prepare translated track",
                    status: translationStatus
                  },
                  {
                    label: "Dubbing",
                    detail: "Planned next",
                    status: dubbingStatus
                  }
                ].map((stage) => (
                  <article
                    className={clsx(
                      "rounded-[1.35rem] border px-4 py-4",
                      getStageTone(stage.status as PipelineStageStatus)
                    )}
                    key={stage.label}
                  >
                    <p className="text-[11px] uppercase tracking-[0.24em] text-fog/75">{stage.label}</p>
                    <p className="mt-3 text-lg font-semibold text-white">{getStageLabel(stage.status as PipelineStageStatus)}</p>
                    <p className="mt-2 text-sm leading-6 text-fog/80">{stage.detail}</p>
                  </article>
                ))}
              </div>
            </section>
          </header>

          {canOpenPlayer && sourceUrl ? (
            <DubbAIPlayer
              onAutoplayNext={handleAutoplayNext}
              src={sourceUrl}
              transcriptWords={projectState.transcriptWords}
            />
          ) : (
            <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-6 py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-aqua/80">Pipeline action</p>
                  <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-sand">
                    {pipelineAction?.title ?? "Waiting for Theater playback"}
                  </h2>
                  <p className="text-sm leading-7 text-fog/75">
                    {pipelineAction?.description ?? "Both text tracks need to be ready before Theater playback unlocks."}
                  </p>
                  {actionError ? (
                    <p className="rounded-[1rem] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {actionError}
                    </p>
                  ) : null}
                </div>

                <div className="grid min-w-[240px] gap-3 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-fog/60">Current gate</p>
                  <p className="text-lg font-semibold text-white">
                    {pipelineAction?.statusLabel ?? "Playback locked"}
                  </p>
                  {activeJob ? (
                    <div
                      aria-busy="true"
                      aria-live="polite"
                      className="space-y-3 rounded-[1rem] border border-aqua/20 bg-aqua/8 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-4 w-4 animate-spin rounded-full border-2 border-aqua/20 border-t-aqua"
                            data-testid="pipeline-spinner"
                          />
                          <span className="text-sm font-semibold text-white">Processing now</span>
                        </div>
                        <span className="text-sm text-fog/80">{activeJob.progress}% complete</span>
                      </div>
                      <p
                        className="text-xs uppercase tracking-[0.22em] text-aqua/85"
                        data-testid="pipeline-elapsed"
                      >
                        Elapsed {formatElapsedJobTime(jobElapsedSeconds)}
                      </p>
                      <p className="text-sm leading-6 text-fog/75">
                        {getJobLabel(activeJob)} is running. Theater refreshes automatically as soon as new stage data is ready.
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          aria-valuemax={100}
                          aria-valuemin={0}
                          aria-valuenow={activeJob.progress}
                          className="h-full rounded-full bg-aqua transition-[width] duration-500"
                          role="progressbar"
                          style={{ width: `${activeJob.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : pipelineAction?.kind ? (
                    <button
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={pendingAction !== null}
                      onClick={() => handlePipelineAction(pipelineAction.kind)}
                      type="button"
                    >
                      {pendingAction === pipelineAction.kind ? "Queueing..." : pipelineAction.buttonLabel}
                    </button>
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-white/10 px-4 py-3 text-sm text-fog/70">
                      Refresh after the active job finishes.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <TheaterPlaylistDrawer
          currentProjectId={currentProjectId}
          isOpen={!shellFullscreen && drawerOpen}
          onNavigate={navigateToProject}
          queue={queue}
        />
      </div>
    </main>
  );
}
