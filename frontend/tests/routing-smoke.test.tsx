import React from "react";
import { existsSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";

import HomePage from "@/app/page";
import ProjectCompatibilityPage from "@/app/projects/[projectId]/page";
import TheaterProjectPage from "@/app/theater/[playlistId]/[projectId]/page";
import { LibraryShell } from "@/components/library/library-shell";
import { useLibraryStore } from "@/store/use-library-store";

const redirect = vi.fn();
const fetchLibrary = vi.fn();
const fetchPlaylistQueue = vi.fn();
const fetchProject = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args)
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    fetchLibrary: (...args: unknown[]) => fetchLibrary(...args),
    fetchPlaylistQueue: (...args: unknown[]) => fetchPlaylistQueue(...args),
    fetchProject: (...args: unknown[]) => fetchProject(...args)
  };
});

describe("routing smoke", () => {
  beforeEach(() => {
    redirect.mockReset();
    fetchLibrary.mockReset();
    fetchPlaylistQueue.mockReset();
    fetchProject.mockReset();
    useLibraryStore.setState({
      folders: [],
      playlists: [],
      projects: [],
      activeFolderId: null,
      activePlaylistId: null,
      filters: { search: "", status: "all" },
      sort: "name-asc",
      queueMetadata: null
    });
  });

  it("sends the home route to /library", () => {
    HomePage();

    expect(redirect).toHaveBeenCalledWith("/library");
  });

  it("exposes a theater CTA from the library flow", () => {
    render(
      <LibraryShell
        initialData={{
          folders: [],
          playlists: [{ id: "playlist-1", name: "Weekend Set", items: [{ projectId: "project-1", position: 1 }] }],
          projects: [
            {
              id: "project-1",
              name: "Freepik 03",
              status: "translation_queued",
              sourceType: "upload",
              sourceUrl: "/storage/uploads/project-1/video.mp4",
              folderId: null,
              sourceLanguage: "en",
              targetLanguage: "pl",
              transcriptStatus: "ready",
              translationStatus: "queued",
              dubbingStatus: "not_started",
              nextAction: "open_theater"
            }
          ]
        }}
      />
    );

    expect(screen.getByRole("link", { name: /open theater/i })).toHaveAttribute(
      "href",
      "/theater/playlist-1/project-1"
    );
  });

  it("keeps the old project route as a compatibility entrypoint", async () => {
    fetchLibrary.mockResolvedValue({
      folders: [],
      playlists: [{ id: "playlist-2", name: "Archive", items: [{ projectId: "project-9", position: 1 }] }],
      projects: []
    });

    await ProjectCompatibilityPage({
      params: Promise.resolve({ projectId: "project-9" })
    });

    expect(redirect).toHaveBeenCalledWith("/theater/playlist-2/project-9");
  });

  it("redirects an invalid theater project id to the first item in the playlist queue", async () => {
    fetchPlaylistQueue.mockResolvedValue({
      playlistId: "playlist-8",
      playlistName: "Review",
      items: [{ projectId: "project-4", title: "Valid entry" }]
    });

    await TheaterProjectPage({
      params: Promise.resolve({ playlistId: "playlist-8", projectId: "project-missing" })
    });

    expect(redirect).toHaveBeenCalledWith("/theater/playlist-8/project-4");
    expect(fetchProject).not.toHaveBeenCalled();
  });

  it("does not keep the legacy project workspace component in the product flow", () => {
    expect(
      existsSync(path.join(process.cwd(), "components", "projects", "project-workspace.tsx"))
    ).toBe(false);
  });
});
