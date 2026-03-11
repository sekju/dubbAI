"use client";

import Link from "next/link";
import clsx from "clsx";

import type { LibraryProjectSummary, PipelineStageStatus } from "@/lib/types";

type ProjectAction =
  | {
      type: "button";
      label: string;
    }
  | {
      type: "link";
      href: string;
      label: string;
    }
  | {
      type: "disabled";
      label: string;
      hint: string;
    };

type LibraryGridProps = {
  projects: LibraryProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onRunProjectAction: (project: LibraryProjectSummary) => void;
  resolveProjectAction: (project: LibraryProjectSummary) => ProjectAction;
};

function formatLanguage(code?: string | null) {
  return code ? code.toUpperCase() : "--";
}

function getStageTone(status?: PipelineStageStatus) {
  switch (status) {
    case "ready":
      return "border-aqua/35 bg-aqua/10 text-ink";
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    case "queued":
    case "in_progress":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-black/10 bg-sand/55 text-ink/70";
  }
}

function getStageLabel(label: string, status?: PipelineStageStatus) {
  const suffix =
    status === "ready"
      ? "ready"
      : status === "failed"
        ? "failed"
        : status === "queued"
          ? "queued"
          : status === "in_progress"
            ? "active"
            : "pending";

  return `${label} ${suffix}`;
}

export function LibraryGrid({
  projects,
  selectedProjectId,
  onSelectProject,
  onRunProjectAction,
  resolveProjectAction
}: LibraryGridProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-ember">Task-first library</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-ink">
            Project tasks
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-ink/65">
          Run the next pipeline step directly from each project card. Use the organization panel only
          when you need folders or playlists.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => {
          const action = resolveProjectAction(project);

          return (
            <article
              aria-label={project.name}
              className={clsx(
                "rounded-[1.6rem] border bg-white px-5 py-5 shadow-panel transition",
                selectedProjectId === project.id
                  ? "border-ember/45 ring-1 ring-ember/25"
                  : "border-black/10"
              )}
              key={project.id}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-ink/45">
                      <span>{project.sourceType}</span>
                      <span className="h-1 w-1 rounded-full bg-ink/25" />
                      <span>{formatLanguage(project.sourceLanguage)} -&gt; {formatLanguage(project.targetLanguage)}</span>
                    </div>
                    <h3 className="text-2xl font-semibold text-ink">{project.name}</h3>
                    <p className="text-sm leading-6 text-ink/65">
                      Next action: <span className="font-semibold text-ink">{action.label}</span>
                    </p>
                  </div>
                  <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
                    {project.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                      getStageTone(project.transcriptStatus)
                    )}
                  >
                    {getStageLabel("Transcript", project.transcriptStatus)}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                      getStageTone(project.translationStatus)
                    )}
                  >
                    {getStageLabel("Translation", project.translationStatus)}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                      getStageTone(project.dubbingStatus)
                    )}
                  >
                    {getStageLabel("Dubbing", project.dubbingStatus)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {action.type === "link" ? (
                    <Link
                      className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
                      href={action.href}
                    >
                      {action.label}
                    </Link>
                  ) : null}

                  {action.type === "button" ? (
                    <button
                      className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
                      onClick={() => onRunProjectAction(project)}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ) : null}

                  {action.type === "disabled" ? (
                    <div className="space-y-2">
                      <button
                        className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white opacity-50"
                        disabled
                        type="button"
                      >
                        {action.label}
                      </button>
                      <p className="text-xs text-ink/55">{action.hint}</p>
                    </div>
                  ) : null}

                  <button
                    className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-black/5"
                    onClick={() => onSelectProject(project.id)}
                    type="button"
                  >
                    Organize {project.name}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
