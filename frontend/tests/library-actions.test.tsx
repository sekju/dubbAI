import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LibraryShell } from "@/components/library/library-shell";
import { useLibraryStore } from "@/store/use-library-store";

const createFolder = vi.fn();
const createPlaylist = vi.fn();
const assignProjectToFolder = vi.fn();
const addProjectToPlaylist = vi.fn();
const removeProject = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    createFolder: (...args: unknown[]) => createFolder(...args),
    createPlaylist: (...args: unknown[]) => createPlaylist(...args),
    assignProjectToFolder: (...args: unknown[]) => assignProjectToFolder(...args),
    addProjectToPlaylist: (...args: unknown[]) => addProjectToPlaylist(...args),
    deleteProject: (...args: unknown[]) => removeProject(...args)
  };
});

const sampleLibrary = {
  folders: [{ id: "folder-1", name: "Inbox", projectIds: ["project-1"] }],
  playlists: [{ id: "playlist-1", name: "Daily", items: [] }],
  projects: [
    {
      id: "project-1",
      name: "Freepik 03",
      status: "transcribed",
      sourceType: "upload" as const,
      sourceUrl: "/storage/uploads/project-1/video.mp4",
      folderId: "folder-1"
    }
  ]
};

describe("Library actions", () => {
  beforeEach(() => {
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

    createFolder.mockReset();
    createPlaylist.mockReset();
    assignProjectToFolder.mockReset();
    addProjectToPlaylist.mockReset();
    removeProject.mockReset();

    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Review Bin")
      .mockReturnValueOnce("Weekend Set");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates collections, moves a project, adds it to a playlist, deletes it, and exposes a Theater CTA", async () => {
    createFolder.mockResolvedValue({ id: "folder-2", name: "Review Bin", projectIds: [] });
    createPlaylist.mockResolvedValue({ id: "playlist-2", name: "Weekend Set", items: [] });
    assignProjectToFolder.mockResolvedValue({
      ...sampleLibrary.projects[0],
      folderId: "folder-2"
    });
    addProjectToPlaylist.mockResolvedValue({
      id: "playlist-2",
      name: "Weekend Set",
      items: [{ projectId: "project-1", position: 1 }]
    });
    removeProject.mockResolvedValue(undefined);

    render(<LibraryShell initialData={sampleLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    await screen.findByRole("button", { name: /review bin/i });
    expect(createFolder).toHaveBeenCalledWith("Review Bin");

    fireEvent.click(screen.getByRole("button", { name: /new playlist/i }));
    await screen.findByRole("button", { name: /weekend set/i });
    expect(createPlaylist).toHaveBeenCalledWith("Weekend Set");

    fireEvent.click(screen.getByRole("button", { name: /select freepik 03/i }));
    fireEvent.click(screen.getByRole("button", { name: /review bin/i }));
    fireEvent.click(screen.getByRole("button", { name: /move to active folder/i }));
    await waitFor(() => expect(assignProjectToFolder).toHaveBeenCalledWith("project-1", "folder-2"));

    fireEvent.click(screen.getByRole("button", { name: /weekend set/i }));
    fireEvent.click(screen.getByRole("button", { name: /add to active playlist/i }));
    await waitFor(() => expect(addProjectToPlaylist).toHaveBeenCalledWith("playlist-2", "project-1"));

    expect(screen.getByRole("link", { name: /open in theater/i })).toHaveAttribute(
      "href",
      "/theater/playlist-2/project-1"
    );

    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    await waitFor(() => expect(removeProject).toHaveBeenCalledWith("project-1"));
    expect(screen.queryByText("Freepik 03")).not.toBeInTheDocument();
  });
});
