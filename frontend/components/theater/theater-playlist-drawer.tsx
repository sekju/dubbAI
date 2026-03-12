"use client";

import clsx from "clsx";

import type { TheaterQueue } from "@/lib/types";

type TheaterPlaylistDrawerProps = {
  currentProjectId: string;
  isOpen: boolean;
  onNavigate: (projectId: string) => void;
  queue: TheaterQueue;
};

export function TheaterPlaylistDrawer({
  currentProjectId,
  isOpen,
  onNavigate,
  queue
}: TheaterPlaylistDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 text-white">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-aqua/75">Playlist drawer</p>
        <h2 className="mt-2 text-2xl font-semibold text-sand">{queue.playlistName}</h2>
      </div>

      <div className="space-y-2">
        {queue.items.map((item, index) => (
          <button
            aria-label={`Open ${item.title}`}
            className={clsx(
              "flex w-full items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left transition",
              item.projectId === currentProjectId
                ? "border-aqua bg-aqua text-ink"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            )}
            key={item.projectId}
            onClick={() => onNavigate(item.projectId)}
            type="button"
          >
            <span>{item.title}</span>
            <span className="text-xs opacity-70">{index + 1}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
