import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LibraryShell } from "@/components/library/library-shell";
import { useLibraryStore } from "@/store/use-library-store";

const createFolder = vi.fn();
const createPlaylist = vi.fn();
const assignProjectToFolder = vi.fn();
const addProjectToPlaylist = vi.fn();
const removeProject = vi.fn();
const createProjectFromUpload = vi.fn();
const createProjectFromUrl = vi.fn();
const fetchLibrary = vi.fn();
const startProjectTranscription = vi.fn();
const startProjectTranslation = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    createFolder: (...args: unknown[]) => createFolder(...args),
    createPlaylist: (...args: unknown[]) => createPlaylist(...args),
    assignProjectToFolder: (...args: unknown[]) => assignProjectToFolder(...args),
    addProjectToPlaylist: (...args: unknown[]) => addProjectToPlaylist(...args),
    deleteProject: (...args: unknown[]) => removeProject(...args),
    createProjectFromUpload: (...args: unknown[]) => createProjectFromUpload(...args),
    createProjectFromUrl: (...args: unknown[]) => createProjectFromUrl(...args),
    fetchLibrary: (...args: unknown[]) => fetchLibrary(...args),
    startProjectTranscription: (...args: unknown[]) => startProjectTranscription(...args),
    startProjectTranslation: (...args: unknown[]) => startProjectTranslation(...args)
  };
});

const sampleLibrary = {
  folders: [{ id: "folder-1", name: "Inbox", projectIds: ["project-1"] }],
  playlists: [{ id: "playlist-1", name: "Daily", items: [] }],
  projects: [
    {
      id: "project-1",
      name: "Freepik 03",
      status: "uploaded",
      sourceType: "upload" as const,
      sourceUrl: "/storage/uploads/project-1/video.mp4",
      folderId: "folder-1",
      sourceLanguage: "en",
      targetLanguage: "pl",
      transcriptStatus: "not_started",
      translationStatus: "not_started",
      dubbingStatus: "not_started",
      nextAction: "transcribe" as const
    },
    {
      id: "project-2",
      name: "German clip",
      status: "transcribed",
      sourceType: "url" as const,
      sourceUrl: "https://example.com/german",
      folderId: null,
      sourceLanguage: "de",
      targetLanguage: "fr",
      transcriptStatus: "ready",
      translationStatus: "failed",
      dubbingStatus: "not_started",
      nextAction: "retry" as const
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
    createProjectFromUpload.mockReset();
    createProjectFromUrl.mockReset();
    fetchLibrary.mockReset();
    startProjectTranscription.mockReset();
    startProjectTranslation.mockReset();

    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Review Bin")
      .mockReturnValueOnce("Weekend Set");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses explicit folder and playlist targets while keeping task actions independent of collection selection", async () => {
    const user = userEvent.setup();

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
    startProjectTranscription.mockResolvedValue({
      jobId: "job-transcribe",
      projectId: "project-1",
      state: "queued",
      progress: 0,
      queue: "transcribe"
    });
    startProjectTranslation.mockResolvedValue({
      jobId: "job-translate",
      projectId: "project-2",
      state: "queued",
      progress: 0,
      queue: "translate"
    });
    fetchLibrary
      .mockResolvedValueOnce({
        ...sampleLibrary,
        projects: sampleLibrary.projects.map((project) =>
          project.id === "project-1"
            ? {
                ...project,
                status: "transcription_queued",
                transcriptStatus: "queued",
                nextAction: "open_theater" as const
              }
            : project
        )
      })
      .mockResolvedValueOnce({
        ...sampleLibrary,
        projects: sampleLibrary.projects.map((project) =>
          project.id === "project-2"
            ? {
                ...project,
                status: "translation_queued",
                translationStatus: "queued",
                nextAction: "open_theater" as const
              }
            : project
        )
      });
    removeProject.mockResolvedValue(undefined);

    render(<LibraryShell initialData={sampleLibrary} />);

    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    await screen.findByText("Review Bin");
    expect(createFolder).toHaveBeenCalledWith("Review Bin");

    fireEvent.click(screen.getByRole("button", { name: /new playlist/i }));
    await screen.findByText("Weekend Set");
    expect(createPlaylist).toHaveBeenCalledWith("Weekend Set");

    const freepikCard = screen.getByRole("article", { name: /freepik 03/i });
    await user.click(within(freepikCard).getByRole("button", { name: /transcribe/i }));
    await waitFor(() => expect(startProjectTranscription).toHaveBeenCalledWith("project-1"));

    const germanCard = screen.getByRole("article", { name: /german clip/i });
    await user.click(within(germanCard).getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(startProjectTranslation).toHaveBeenCalledWith("project-2"));

    await user.click(within(freepikCard).getByRole("button", { name: /organize freepik 03/i }));
    expect(screen.getByLabelText(/folder target/i)).toHaveValue("");
    expect(screen.getByLabelText(/playlist target/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /move to folder/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /add to playlist/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/folder target/i), "folder-2");
    await user.click(screen.getByRole("button", { name: /move to folder/i }));
    await waitFor(() => expect(assignProjectToFolder).toHaveBeenCalledWith("project-1", "folder-2"));

    await user.selectOptions(screen.getByLabelText(/playlist target/i), "playlist-2");
    await user.click(screen.getByRole("button", { name: /add to playlist/i }));
    await waitFor(() => expect(addProjectToPlaylist).toHaveBeenCalledWith("playlist-2", "project-1"));

    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    await waitFor(() => expect(removeProject).toHaveBeenCalledWith("project-1"));
    expect(screen.queryByText("Freepik 03")).not.toBeInTheDocument();
  });

  it("blocks duplicate pipeline requests while an action is still in flight", async () => {
    const user = userEvent.setup();

    let resolveTranscription: ((value: {
      jobId: string;
      projectId: string;
      state: "queued";
      progress: number;
      queue: string;
    }) => void) | null = null;

    startProjectTranscription.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranscription = resolve;
        })
    );

    render(<LibraryShell initialData={sampleLibrary} />);

    const freepikCard = screen.getByRole("article", { name: /freepik 03/i });
    const transcribeButton = within(freepikCard).getByRole("button", { name: /transcribe/i });

    await user.click(transcribeButton);
    await user.click(transcribeButton);

    expect(startProjectTranscription).toHaveBeenCalledTimes(1);

    resolveTranscription?.({
      jobId: "job-transcribe",
      projectId: "project-1",
      state: "queued",
      progress: 0,
      queue: "transcribe"
    });

    await waitFor(() =>
      expect(within(screen.getByRole("article", { name: /freepik 03/i })).getByRole("button", { name: /organize freepik 03/i }))
        .toBeInTheDocument()
    );
  });

  it("submits upload and url intake with language selections from the library header", async () => {
    const user = userEvent.setup();

    createProjectFromUpload.mockResolvedValue({
      jobId: "job-upload",
      projectId: "project-3",
      state: "queued",
      progress: 0,
      queue: "ingest"
    });
    createProjectFromUrl.mockResolvedValue({
      jobId: "job-url",
      projectId: "project-4",
      state: "queued",
      progress: 0,
      queue: "ingest"
    });
    fetchLibrary
      .mockResolvedValueOnce({
        ...sampleLibrary,
        projects: [
          ...sampleLibrary.projects,
          {
            id: "project-3",
            name: "Upload clip",
            status: "queued",
            sourceType: "upload" as const,
            sourceUrl: "/storage/uploads/project-3/video.mp4",
            folderId: null,
            sourceLanguage: "en",
            targetLanguage: "pl",
            transcriptStatus: "queued",
            translationStatus: "not_started",
            dubbingStatus: "not_started",
            nextAction: "open_theater" as const
          }
        ]
      })
      .mockResolvedValueOnce({
        ...sampleLibrary,
        projects: [
          ...sampleLibrary.projects,
          {
            id: "project-3",
            name: "Upload clip",
            status: "queued",
            sourceType: "upload" as const,
            sourceUrl: "/storage/uploads/project-3/video.mp4",
            folderId: null,
            sourceLanguage: "en",
            targetLanguage: "pl",
            transcriptStatus: "queued",
            translationStatus: "not_started",
            dubbingStatus: "not_started",
            nextAction: "open_theater" as const
          },
          {
            id: "project-4",
            name: "Remote clip",
            status: "queued",
            sourceType: "url" as const,
            sourceUrl: "https://youtube.com/watch?v=abc",
            folderId: null,
            sourceLanguage: "pl",
            targetLanguage: "en",
            transcriptStatus: "queued",
            translationStatus: "not_started",
            dubbingStatus: "not_started",
            nextAction: "open_theater" as const
          }
        ]
      });

    render(<LibraryShell initialData={sampleLibrary} />);

    expect(screen.getByLabelText(/source language/i)).toHaveValue("en");
    expect(screen.getByLabelText(/target language/i)).toHaveValue("pl");

    await user.type(screen.getByLabelText(/project name/i), "Upload clip");
    await user.upload(
      screen.getByLabelText(/video file/i),
      new File(["video"], "clip.mp4", { type: "video/mp4" })
    );
    await user.click(screen.getByRole("button", { name: /add upload to library/i }));

    await waitFor(() =>
      expect(createProjectFromUpload).toHaveBeenCalledWith(
        "Upload clip",
        expect.any(File),
        expect.objectContaining({ sourceLanguage: "en", targetLanguage: "pl" })
      )
    );
    expect(await screen.findByRole("article", { name: /upload clip/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remote ingest/i }));
    await user.clear(screen.getByLabelText(/project name/i));
    await user.selectOptions(screen.getByLabelText(/source language/i), "pl");
    expect(screen.getByLabelText(/target language/i)).toHaveValue("en");
    await user.type(screen.getByLabelText(/project name/i), "Remote clip");
    await user.type(screen.getByLabelText(/video url/i), "https://youtube.com/watch?v=abc");
    await user.click(screen.getByRole("button", { name: /import link to library/i }));

    await waitFor(() =>
      expect(createProjectFromUrl).toHaveBeenCalledWith(
        "Remote clip",
        "https://youtube.com/watch?v=abc",
        expect.objectContaining({ sourceLanguage: "pl", targetLanguage: "en" })
      )
    );
    expect(await screen.findByRole("article", { name: /remote clip/i })).toBeInTheDocument();
  });

  it("polls queued pipeline work and updates the card without manual refresh", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    startProjectTranscription.mockResolvedValue({
      jobId: "job-transcribe",
      projectId: "project-1",
      state: "queued",
      progress: 0,
      queue: "transcribe"
    });
    fetchLibrary.mockResolvedValue({
      ...sampleLibrary,
      projects: sampleLibrary.projects.map((project) =>
        project.id === "project-1"
          ? {
              ...project,
              status: "transcription_failed",
              transcriptStatus: "failed",
              nextAction: "retry" as const
            }
          : project
      )
    });

    render(<LibraryShell initialData={sampleLibrary} />);

    const freepikCard = screen.getByRole("article", { name: /freepik 03/i });
    fireEvent.click(within(freepikCard).getByRole("button", { name: /transcribe/i }));

    await waitFor(() => expect(startProjectTranscription).toHaveBeenCalledWith("project-1"));
    await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000));
  });
});
