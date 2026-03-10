import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import HomePage from "@/app/page";
import ProjectCompatibilityPage from "@/app/projects/[projectId]/page";
import { LibraryShell } from "@/components/library/library-shell";
import { useLibraryStore } from "@/store/use-library-store";

const redirect = vi.fn();
const fetchLibrary = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args)
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    fetchLibrary: (...args: unknown[]) => fetchLibrary(...args)
  };
});

describe("routing smoke", () => {
  beforeEach(() => {
    redirect.mockReset();
    fetchLibrary.mockReset();
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
              status: "transcribed",
              sourceType: "upload",
              sourceUrl: "/storage/uploads/project-1/video.mp4",
              folderId: null
            }
          ]
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /weekend set/i }));
    fireEvent.click(screen.getByRole("button", { name: /select freepik 03/i }));

    expect(screen.getByRole("link", { name: /open in theater/i })).toHaveAttribute(
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
});
