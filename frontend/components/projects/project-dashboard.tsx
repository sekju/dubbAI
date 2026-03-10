"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { createProjectFromUpload, createProjectFromUrl, fetchProjects } from "@/lib/api";
import type { ProjectSummary } from "@/lib/types";
import { ProjectIntakeForm } from "@/components/projects/project-intake-form";

function getStatusMeta(status: string) {
  if (status === "transcribed") {
    return {
      label: "Ready",
      tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
      helper: "Transcript is ready for review"
    };
  }

  if (status.includes("queued") || status.includes("started")) {
    return {
      label: "Processing",
      tone: "bg-amber-100 text-amber-800 border-amber-200",
      helper: "Pipeline job is running"
    };
  }

  if (status.includes("failed")) {
    return {
      label: "Attention",
      tone: "bg-red-100 text-red-700 border-red-200",
      helper: "This project needs a retry"
    };
  }

  return {
    label: "Draft",
    tone: "bg-slate-200 text-slate-700 border-slate-300",
    helper: "Project is waiting for the next action"
  };
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function reloadProjects() {
    setIsLoading(true);
    try {
      setProjects(await fetchProjects());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reloadProjects();
  }, []);

  async function handleUpload(name: string, file: File) {
    await createProjectFromUpload(name, file);
    await reloadProjects();
  }

  async function handleImport(name: string, sourceUrl: string) {
    await createProjectFromUrl(name, sourceUrl);
    await reloadProjects();
  }

  const readyProjects = projects.filter((project) => project.status === "transcribed").length;
  const queuedProjects = projects.filter(
    (project) => project.status.includes("queued") || project.status.includes("started")
  ).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(82,209,198,0.22),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(200,92,53,0.16),transparent_18%),linear-gradient(180deg,#f4ecde_0%,#eef3f7_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 lg:px-8 lg:py-10">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-ink text-white shadow-panel">
            <div className="space-y-8 px-6 py-7 lg:px-8">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.34em] text-aqua">DubbAI workspace</p>
                <div className="space-y-3">
                  <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.02] text-sand lg:text-6xl">
                    Project library for transcript, translation, dubbing, and export.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-fog/80">
                    This is the control room. Add source material on the right, then manage every
                    active video from a single library instead of juggling one-off upload forms.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.6rem] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-fog/55">Project library</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{projects.length}</p>
                  <p className="mt-2 text-sm text-fog/75">
                    {projects.length === 1 ? "1 active project" : `${projects.length} active projects`}
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-fog/55">Ready to review</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{readyProjects}</p>
                  <p className="mt-2 text-sm text-fog/75">Projects with transcript ready in workspace</p>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-fog/55">In pipeline</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{queuedProjects}</p>
                  <p className="mt-2 text-sm text-fog/75">Sources currently queued or processing</p>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-fog/75 lg:grid-cols-[1fr_1fr_auto]">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                  Keep the library clean with descriptive project names tied to deliverables or cuts.
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
                  Open the workspace as soon as a source lands to trigger transcription and review the result.
                </div>
                <a
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-aqua hover:bg-white/8"
                  href="http://localhost:8000/api/docs"
                >
                  API docs
                </a>
              </div>
            </div>
          </div>

          <ProjectIntakeForm onImportUrl={handleImport} onUploadFile={handleUpload} />
        </section>

        <section className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-white/70 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-6 px-6 py-7 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.28em] text-aqua">Project library</p>
                <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold text-ink">
                  Active workspace queue
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-ink/65">
                  Every source lands here first. Use the library to reopen workspaces, see project
                  readiness at a glance, and avoid losing track of ingest jobs.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-ink px-4 py-2 font-semibold text-white">
                  {projects.length === 1 ? "1 active project" : `${projects.length} active projects`}
                </span>
                {isLoading ? (
                  <span className="rounded-full border border-black/10 bg-white px-4 py-2 text-ink/60">
                    Refreshing library...
                  </span>
                ) : null}
              </div>
            </div>

            {error ? (
              <p className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {projects.length === 0 && !isLoading ? (
              <div className="grid gap-5 rounded-[1.8rem] border border-dashed border-black/10 bg-sand/40 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.26em] text-ember">Empty library</p>
                  <h3 className="text-3xl font-semibold text-ink">No projects yet.</h3>
                  <p className="max-w-xl text-sm leading-6 text-ink/65">
                    Create the first entry from the intake panel above. Once a source is added,
                    it will appear here with status, source type, and a direct path into the workspace.
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-ink/65">
                  <div className="rounded-[1.3rem] border border-black/10 bg-white/70 px-4 py-4">
                    Upload a master file when you already have the source locally.
                  </div>
                  <div className="rounded-[1.3rem] border border-black/10 bg-white/70 px-4 py-4">
                    Import from a URL when you want yt-dlp to fetch the source for you.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((project) => {
                const statusMeta = getStatusMeta(project.status);
                return (
                  <Link
                    className="group rounded-[1.8rem] border border-black/10 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-ember/35 hover:shadow-panel"
                    href={`/projects/${project.id}`}
                    key={project.id}
                  >
                    <div className="flex h-full flex-col gap-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-ink/45">
                            {project.sourceType === "upload" ? "Local upload" : "Remote source"}
                          </p>
                          <h3 className="text-2xl font-semibold tracking-tight text-ink">
                            {project.name}
                          </h3>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusMeta.tone}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.25rem] bg-sand/45 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Status</p>
                          <p className="mt-2 text-sm font-semibold text-ink">{statusMeta.helper}</p>
                        </div>
                        <div className="rounded-[1.25rem] bg-sand/45 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Segments</p>
                          <p className="mt-2 text-sm font-semibold text-ink">
                            {project.transcriptSegments.length} ready for review
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] bg-sand/45 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">Next step</p>
                          <p className="mt-2 text-sm font-semibold text-ink">
                            {project.status === "transcribed" ? "Review workspace" : "Continue pipeline"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-4 border-t border-black/8 pt-4">
                        <p className="text-sm text-ink/60">
                          Source: {project.sourceType === "upload" ? "Uploaded file" : "Imported URL"}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-ember">
                          Open workspace
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
