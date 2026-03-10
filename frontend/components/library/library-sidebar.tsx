"use client";

import clsx from "clsx";

import type { LibraryFolder, LibraryPlaylist } from "@/lib/types";

type LibrarySidebarProps = {
  activeFolderId: string | null;
  activePlaylistId: string | null;
  folders: LibraryFolder[];
  onCreateFolder: () => void;
  onCreatePlaylist: () => void;
  playlists: LibraryPlaylist[];
  onSelectFolder: (folderId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
};

export function LibrarySidebar({
  activeFolderId,
  activePlaylistId,
  folders,
  onCreateFolder,
  onCreatePlaylist,
  playlists,
  onSelectFolder,
  onSelectPlaylist
}: LibrarySidebarProps) {
  return (
    <aside className="rounded-[1.75rem] border border-black/10 bg-[#111318] p-5 text-white shadow-panel">
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-aqua/80">Library</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-sand">
            Collections
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              onClick={onCreateFolder}
              type="button"
            >
              New folder
            </button>
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              onClick={onCreatePlaylist}
              type="button"
            >
              New playlist
            </button>
          </div>
        </div>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.26em] text-fog/65">Folders</p>
          <div className="space-y-2">
            {folders.map((folder) => (
              <button
                className={clsx(
                  "flex w-full items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left transition",
                  activeFolderId === folder.id
                    ? "border-aqua bg-aqua text-ink"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"
                )}
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                type="button"
              >
                <span>{folder.name}</span>
                <span className="text-xs opacity-75">{folder.projectIds.length}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.26em] text-fog/65">Playlists</p>
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <button
                className={clsx(
                  "flex w-full items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left transition",
                  activePlaylistId === playlist.id
                    ? "border-ember bg-ember text-white"
                    : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10"
                )}
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist.id)}
                type="button"
              >
                <span>{playlist.name}</span>
                <span className="text-xs opacity-75">{playlist.items.length}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
