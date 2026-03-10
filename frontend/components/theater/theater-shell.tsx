"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import type { ProjectSummary, TheaterQueue } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/api";
import { useTheaterQueueStore } from "@/store/use-theater-queue-store";

import { TheaterPlaylistDrawer } from "./theater-playlist-drawer";

type TheaterShellProps = {
  currentProjectId: string;
  fullscreen?: boolean;
  onNavigate?: (projectId: string) => void;
  project: ProjectSummary;
  queue: TheaterQueue;
};

export function TheaterShell({
  currentProjectId,
  fullscreen = false,
  onNavigate,
  project,
  queue
}: TheaterShellProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { autoplay, currentIndex, items, loadQueue, goNext } = useTheaterQueueStore();
  const sourceUrl = resolveMediaUrl(project.sourceUrl);

  useEffect(() => {
    loadQueue({
      playlistId: queue.playlistId,
      currentProjectId,
      items: queue.items
    });
  }, [currentProjectId, loadQueue, queue]);

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

  return (
    <main
      className="min-h-screen bg-[#0a1016] px-5 py-6 text-white lg:px-8"
      data-fullscreen={fullscreen ? "true" : "false"}
      data-testid="theater-shell"
    >
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <header className="flex flex-col gap-4 rounded-[1.8rem] border border-white/10 bg-white/5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-aqua/80">Theater</p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-sand">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-fog/75">Playlist: {queue.playlistName}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <button
                className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
                onClick={() => setDrawerOpen((value) => !value)}
                type="button"
              >
                Playlist
              </button>
              {!fullscreen ? (
                <Link
                  className="rounded-full bg-white px-4 py-2 font-semibold text-ink transition hover:bg-sand"
                  href="/library"
                >
                  Back to Library
                </Link>
              ) : null}
            </div>
          </header>

          {sourceUrl ? (
            <DubbAIPlayer
              cues={project.transcriptSegments}
              onAutoplayNext={handleAutoplayNext}
              src={sourceUrl}
            />
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/15 px-6 py-10 text-fog/70">
              Media source is not ready yet.
            </div>
          )}
        </div>

        <TheaterPlaylistDrawer
          currentProjectId={currentProjectId}
          isOpen={drawerOpen}
          onNavigate={navigateToProject}
          queue={queue}
        />
      </div>
    </main>
  );
}
