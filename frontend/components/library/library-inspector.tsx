"use client";

import type { LibraryFolder, LibraryPlaylist, LibraryProjectSummary } from "@/lib/types";

type LibraryInspectorProps = {
  folders: LibraryFolder[];
  folderTargetId: string;
  onAddToPlaylist: () => void;
  onDeleteProject: () => void;
  onMoveToFolder: () => void;
  onSelectFolderTarget: (folderId: string) => void;
  onSelectPlaylistTarget: (playlistId: string) => void;
  playlistTargetId: string;
  playlists: LibraryPlaylist[];
  project: LibraryProjectSummary | null;
};

export function LibraryInspector({
  folders,
  folderTargetId,
  onAddToPlaylist,
  onDeleteProject,
  onMoveToFolder,
  onSelectFolderTarget,
  onSelectPlaylistTarget,
  playlistTargetId,
  playlists,
  project
}: LibraryInspectorProps) {
  return (
    <aside className="rounded-[1.75rem] border border-black/10 bg-white/85 p-5 shadow-panel">
      {project ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-aqua">Selected project</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
              {project.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Explicitly choose a folder or playlist target here. Organization should not depend on a
              separately active collection state.
            </p>
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
              <dt className="text-xs uppercase tracking-[0.24em] text-ink/45">Languages</dt>
              <dd className="mt-2 font-semibold text-ink">
                {(project.sourceLanguage ?? "--").toUpperCase()} -&gt; {(project.targetLanguage ?? "--").toUpperCase()}
              </dd>
            </div>
          </dl>

          <div className="grid gap-4 rounded-[1.3rem] border border-black/10 bg-sand/45 p-4">
            <label className="grid gap-2 text-sm font-medium text-ink">
              <span>Folder target</span>
              <select
                aria-label="Folder target"
                className="rounded-[1rem] border border-black/10 bg-white px-4 py-3 text-ink"
                onChange={(event) => onSelectFolderTarget(event.target.value)}
                value={folderTargetId}
              >
                <option value="">Choose folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!folderTargetId}
              onClick={onMoveToFolder}
              type="button"
            >
              Move to folder
            </button>

            <label className="grid gap-2 text-sm font-medium text-ink">
              <span>Playlist target</span>
              <select
                aria-label="Playlist target"
                className="rounded-[1rem] border border-black/10 bg-white px-4 py-3 text-ink"
                onChange={(event) => onSelectPlaylistTarget(event.target.value)}
                value={playlistTargetId}
              >
                <option value="">Choose playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!playlistTargetId}
              onClick={onAddToPlaylist}
              type="button"
            >
              Add to playlist
            </button>
          </div>

          <div className="grid gap-2">
            <button
              className="rounded-full border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              onClick={onDeleteProject}
              type="button"
            >
              Delete project
            </button>
          </div>

        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-aqua">Organization</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            Choose a project
          </h2>
          <p className="text-sm leading-6 text-ink/65">
            Choose a project card to assign folders, add it to a playlist, or remove it from the
            library.
          </p>
        </div>
      )}
    </aside>
  );
}
