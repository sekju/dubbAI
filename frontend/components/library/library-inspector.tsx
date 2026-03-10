"use client";

import Link from "next/link";

import type { LibraryPlaylist, LibraryProjectSummary } from "@/lib/types";

type LibraryInspectorProps = {
  activeFolderId: string | null;
  activePlaylistId: string | null;
  onAddToPlaylist: () => void;
  onDeleteProject: () => void;
  onMoveToFolder: () => void;
  playlist: LibraryPlaylist | null;
  project: LibraryProjectSummary | null;
};

export function LibraryInspector({
  activeFolderId,
  activePlaylistId,
  onAddToPlaylist,
  onDeleteProject,
  onMoveToFolder,
  playlist,
  project
}: LibraryInspectorProps) {
  const theaterHref =
    project && playlist ? `/theater/${playlist.id}/${project.id}` : null;

  return (
    <aside className="rounded-[1.75rem] border border-black/10 bg-white/85 p-5 shadow-panel">
      {project ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-aqua">Selected project</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
              {project.name}
            </h2>
          </div>

          <dl className="grid gap-3 text-sm text-ink/72">
            <div className="rounded-[1.2rem] bg-sand/55 px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.24em] text-ink/45">Status</dt>
              <dd className="mt-2 font-semibold text-ink">{project.status}</dd>
            </div>
            <div className="rounded-[1.2rem] bg-sand/55 px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.24em] text-ink/45">Source</dt>
              <dd className="mt-2 font-semibold uppercase tracking-[0.18em] text-ink">{project.sourceType}</dd>
            </div>
            <div className="rounded-[1.2rem] bg-sand/55 px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.24em] text-ink/45">Playlist</dt>
              <dd className="mt-2 font-semibold text-ink">{playlist?.name ?? "Select a playlist"}</dd>
            </div>
          </dl>

          <div className="grid gap-2">
            <button
              className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activeFolderId}
              onClick={onMoveToFolder}
              type="button"
            >
              Move to active folder
            </button>
            <button
              className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activePlaylistId}
              onClick={onAddToPlaylist}
              type="button"
            >
              Add to active playlist
            </button>
            <button
              className="rounded-full border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              onClick={onDeleteProject}
              type="button"
            >
              Delete project
            </button>
          </div>

          {theaterHref ? (
            <Link
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
              href={theaterHref}
            >
              Open in Theater
            </Link>
          ) : (
            <p className="rounded-[1.2rem] border border-dashed border-black/15 px-4 py-3 text-sm text-ink/60">
              Select a playlist to launch Theater from this inspector.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-aqua">Inspector</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            Nothing selected
          </h2>
          <p className="text-sm leading-6 text-ink/65">
            Pick a project from the grid to see its status and jump into Theater.
          </p>
        </div>
      )}
    </aside>
  );
}
