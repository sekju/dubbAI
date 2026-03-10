"use client";

import React, { useEffect, useRef, useState } from "react";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import { fetchJob, fetchProject, resolveMediaUrl, startProjectTranscription } from "@/lib/api";
import type { JobStatus, ProjectSummary } from "@/lib/types";

type ProjectWorkspaceProps = {
  projectId: string;
};

function statusTone(status: string): string {
  if (status === "transcribed") {
    return "bg-emerald-500/12 text-emerald-800";
  }
  if (status.includes("failed")) {
    return "bg-red-500/12 text-red-700";
  }
  return "bg-amber-500/12 text-amber-800";
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        setProject(await fetchProject(projectId));
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load project");
      }
    }

    void loadProject();
  }, [projectId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeJob || activeJob.state === "success" || activeJob.state === "failure") {
      return;
    }

    let cancelled = false;
    const jobId = activeJob.jobId;

    async function pollJob() {
      try {
        const nextJob = await fetchJob(jobId);
        if (cancelled) {
          return;
        }

        setActiveJob(nextJob);

        if (nextJob.state === "success") {
          setProject(await fetchProject(projectId));
          return;
        }

        if (nextJob.state !== "failure") {
          pollTimerRef.current = setTimeout(() => {
            void pollJob();
          }, 1500);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Failed to refresh job");
        }
      }
    }

    pollTimerRef.current = setTimeout(() => {
      void pollJob();
    }, 1500);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [activeJob, projectId]);

  async function handleStartTranscription() {
    setIsSubmitting(true);
    try {
      const job = await startProjectTranscription(projectId);
      setActiveJob(job);
      setProject((current) =>
        current
          ? {
              ...current,
              status: "transcription_queued"
            }
          : current
      );
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to queue transcription");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error) {
    return <p className="rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  }

  if (!project) {
    return <p className="text-ink/60">Loading project...</p>;
  }

  const sourceUrl = resolveMediaUrl(project.sourceUrl);
  const transcriptionBusy =
    isSubmitting || activeJob?.state === "queued" || activeJob?.state === "started";

  return (
    <main className="mx-auto max-w-[1700px] space-y-8 px-4 py-6 md:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2.5rem] border border-black/10 bg-[linear-gradient(135deg,#f3ede2,#eef4f8)] shadow-[0_30px_80px_rgba(17,19,24,0.08)]">
        <div className="grid gap-6 px-5 py-6 md:px-7 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.34em] text-ember">Project Workspace</p>
            <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-4xl font-bold leading-tight text-ink md:text-5xl">
              {project.name}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-ink/72 md:text-lg">
              A cinematic viewing surface with quick subtitle controls, transcript navigation and
              live mix controls. The video now owns the screen instead of competing with the editor.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua">Status</p>
              <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusTone(project.status)}`}>
                {project.status}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua">Segments</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{project.transcriptSegments.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-aqua">Source</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink/70">
                {project.sourceType}
              </p>
            </div>
          </div>
        </div>
      </section>

      {activeJob ? (
        <section className="rounded-[1.75rem] border border-black/10 bg-white/85 px-5 py-4 text-sm text-ink/70 shadow-panel">
          Job {activeJob.state} on queue {activeJob.queue} ({activeJob.progress}%).
        </section>
      ) : null}

      {!project.transcriptSegments.length ? (
        <section className="grid gap-5 rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-panel lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-aqua">Before playback</p>
            <h2 className="text-3xl font-semibold text-ink">Generate the subtitle timeline first</h2>
            <p className="max-w-2xl text-ink/68">
              Once transcription finishes, this view turns into the cinema workspace with subtitle
              controls, transcript navigation and audio mix.
            </p>
          </div>

          <div className="flex items-center justify-start lg:justify-end">
            <button
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
              disabled={transcriptionBusy}
              onClick={() => void handleStartTranscription()}
              type="button"
            >
              {isSubmitting ? "Queueing..." : transcriptionBusy ? "Transcription running..." : "Start transcription"}
            </button>
          </div>
        </section>
      ) : null}

      {sourceUrl ? (
        <DubbAIPlayer cues={project.transcriptSegments} dubbingSrc={null} src={sourceUrl} />
      ) : (
        <div className="rounded-[2rem] border border-dashed border-black/15 bg-white/60 px-6 py-10 text-ink/70">
          Media source is not ready yet.
        </div>
      )}
    </main>
  );
}
