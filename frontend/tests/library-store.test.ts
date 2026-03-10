import { useLibraryStore } from "@/store/use-library-store";

describe("useLibraryStore", () => {
  beforeEach(() => {
    useLibraryStore.setState({
      folders: [],
      playlists: [],
      projects: [],
      activeFolderId: null,
      activePlaylistId: null,
      filters: {
        search: "",
        status: "all",
      },
      sort: "name-asc",
      queueMetadata: null,
    });
  });

  it("selects the active folder and clears the active playlist", () => {
    useLibraryStore.getState().selectPlaylist("playlist-1");
    useLibraryStore.getState().selectFolder("folder-1");

    expect(useLibraryStore.getState().activeFolderId).toBe("folder-1");
    expect(useLibraryStore.getState().activePlaylistId).toBeNull();
  });

  it("selects the active playlist and clears the active folder", () => {
    useLibraryStore.getState().selectFolder("folder-1");
    useLibraryStore.getState().selectPlaylist("playlist-1");

    expect(useLibraryStore.getState().activePlaylistId).toBe("playlist-1");
    expect(useLibraryStore.getState().activeFolderId).toBeNull();
  });

  it("stores sort and filter preferences", () => {
    useLibraryStore.getState().setSearch("cinema");
    useLibraryStore.getState().setStatusFilter("transcribed");
    useLibraryStore.getState().setSort("updated-desc");

    expect(useLibraryStore.getState().filters).toEqual({
      search: "cinema",
      status: "transcribed",
    });
    expect(useLibraryStore.getState().sort).toBe("updated-desc");
  });

  it("stores playlist queue metadata for theater launch", () => {
    useLibraryStore.getState().setQueueMetadata({
      playlistId: "playlist-1",
      projectIds: ["project-2", "project-3"],
      currentProjectId: "project-2",
    });

    expect(useLibraryStore.getState().queueMetadata).toEqual({
      playlistId: "playlist-1",
      projectIds: ["project-2", "project-3"],
      currentProjectId: "project-2",
    });
  });
});
