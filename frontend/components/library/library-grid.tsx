"use client";

import clsx from "clsx";

import type { LibraryProjectSummary } from "@/lib/types";

type LibraryGridProps = {
  projects: LibraryProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
};

export function LibraryGrid({ projects, selectedProjectId, onSelectProject }: LibraryGridProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ember">Library view</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-ink">
          Active projects
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <button
            aria-label={`Select ${project.name}`}
            className={clsx(
              "rounded-[1.6rem] border bg-white px-5 py-5 text-left shadow-panel transition",
              selectedProjectId === project.id
                ? "border-ember/45 ring-1 ring-ember/25"
                : "border-black/10 hover:-translate-y-0.5 hover:border-black/20"
            )}
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            type="button"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-ink/45">{project.sourceType}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-ink">{project.name}</h3>
                </div>
                <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">
                  {project.status}
                </span>
              </div>
              <p className="text-sm leading-6 text-ink/65">
                Organize this project in Library, then jump into Theater when the playlist is ready.
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
