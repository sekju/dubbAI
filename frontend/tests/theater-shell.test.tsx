import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TheaterShell } from "@/components/theater/theater-shell";
import { usePlayerStore } from "@/store/use-player-store";

const fetchJob = vi.fn();
const fetchProject = vi.fn();
const startProjectTranscription = vi.fn();
const startProjectTranslation = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    fetchJob: (...args: unknown[]) => fetchJob(...args),
    fetchProject: (...args: unknown[]) => fetchProject(...args),
    startProjectTranscription: (...args: unknown[]) => startProjectTranscription(...args),
    startProjectTranslation: (...args: unknown[]) => startProjectTranslation(...args)
  };
});

const queue = {
  playlistId: "playlist-1",
  playlistName: "Morning Watch",
  items: [
    { projectId: "project-1", title: "Intro" },
    { projectId: "project-2", title: "Freepik 03" },
    { projectId: "project-3", title: "Finale" }
  ]
};

const baseProject = {
  id: "project-2",
  name: "Freepik 03",
  status: "uploaded",
  sourceType: "upload" as const,
  sourceUrl: "/storage/uploads/project-2/video.mp4",
  sourceLanguage: "en",
  targetLanguage: "pl",
  transcriptSegments: [
    {
      id: "cue-1",
      speaker: "Speaker A",
      originalText: "Hello",
      translatedText: "Czesc",
      startMs: 0,
      endMs: 1000,
      words: []
    }
  ],
  transcriptWords: [
    {
      position: 1,
      startMs: 0,
      endMs: 1000,
      originalText: "Hello",
      translatedText: "Czesc",
      keyword: false
    }
  ]
};

describe("TheaterShell", () => {
  beforeEach(() => {
    fetchJob.mockReset();
    fetchProject.mockReset();
    startProjectTranscription.mockReset();
    startProjectTranslation.mockReset();
    usePlayerStore.setState({
      density: "balanced",
      primaryTrack: "translation",
      secondaryTrack: "original",
      primaryTiktokMode: false,
      secondaryTiktokMode: false,
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      volume: 80,
      playbackRate: 1,
      autoplay: true,
      isFullscreen: false,
      overlayVisible: true,
      settingsOpen: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows pipeline stages and starts transcription before player mode", async () => {
    startProjectTranscription.mockResolvedValue({
      jobId: "job-transcribe",
      projectId: "project-2",
      state: "queued",
      progress: 0,
      queue: "transcribe"
    });

    render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          transcriptStatus: "not_started",
          translationStatus: "not_started",
          dubbingStatus: "not_started",
          transcriptSegments: []
        }}
        queue={queue}
      />
    );

    expect(screen.getByText(/pipeline stages/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start transcription/i })).toBeInTheDocument();
    expect(screen.queryByTestId("player-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start transcription/i }));

    await waitFor(() => expect(startProjectTranscription).toHaveBeenCalledWith("project-2"));
    expect(screen.getAllByText(/transcription queued/i).length).toBeGreaterThan(0);
  });

  it("shows start translation when transcript is ready but translation is still missing", async () => {
    startProjectTranslation.mockResolvedValue({
      jobId: "job-translate",
      projectId: "project-2",
      state: "queued",
      progress: 0,
      queue: "translate"
    });

    render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "transcribed",
          transcriptStatus: "ready",
          translationStatus: "not_started",
          dubbingStatus: "not_started"
        }}
        queue={queue}
      />
    );

    expect(screen.getByRole("button", { name: /start translation/i })).toBeInTheDocument();
    expect(screen.queryByTestId("player-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start translation/i }));

    await waitFor(() => expect(startProjectTranslation).toHaveBeenCalledWith("project-2"));
    expect(screen.getAllByText(/translation queued/i).length).toBeGreaterThan(0);
  });

  it("shows retry translation when the translation stage failed", async () => {
    startProjectTranslation.mockResolvedValue({
      jobId: "job-retry-translate",
      projectId: "project-2",
      state: "queued",
      progress: 0,
      queue: "translate"
    });

    render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "translation_failed",
          transcriptStatus: "ready",
          translationStatus: "failed",
          dubbingStatus: "not_started"
        }}
        queue={queue}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /retry translation/i }));

    await waitFor(() => expect(startProjectTranslation).toHaveBeenCalledWith("project-2"));
    expect(screen.getAllByText(/translation queued/i).length).toBeGreaterThan(0);
  });

  it("opens player mode only when transcript and translation are ready, while keeping the playlist drawer available", () => {
    const onNavigate = vi.fn();

    render(
      <TheaterShell
        currentProjectId="project-2"
        onNavigate={onNavigate}
        project={{
          ...baseProject,
          status: "ready",
          transcriptStatus: "ready",
          translationStatus: "ready",
          dubbingStatus: "not_started"
        }}
        queue={queue}
      />
    );

    expect(screen.getByTestId("player-overlay")).toBeInTheDocument();
    expect(screen.queryByText("Playlist drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /playlist/i }));

    expect(screen.getByText("Playlist drawer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open finale/i }));
    expect(onNavigate).toHaveBeenCalledWith("project-3");
  });

  it("keeps Theater in pipeline mode when stage statuses are ready but subtitle payload is still missing", () => {
    render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "ready",
          transcriptStatus: "ready",
          translationStatus: "ready",
          dubbingStatus: "not_started",
          transcriptSegments: [],
          transcriptWords: []
        }}
        queue={queue}
      />
    );

    expect(screen.queryByTestId("player-overlay")).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for theater playback/i)).toBeInTheDocument();
  });

  it("keeps the theater layout clean in fullscreen mode", () => {
    usePlayerStore.setState({ isFullscreen: true });

    render(
      <TheaterShell
        currentProjectId="project-2"
        onNavigate={vi.fn()}
        project={{
          ...baseProject,
          status: "ready",
          transcriptStatus: "ready",
          translationStatus: "ready",
          dubbingStatus: "not_started"
        }}
        queue={queue}
      />
    );

    expect(screen.getByTestId("theater-shell")).toHaveAttribute("data-fullscreen", "true");
    expect(screen.queryByRole("link", { name: /back to library/i })).not.toBeInTheDocument();
  });

  it("shows live pipeline progress and refreshes the project when the active job completes", async () => {
    vi.useFakeTimers();

    fetchJob
      .mockResolvedValueOnce({
        jobId: "job-transcribe",
        projectId: "project-2",
        state: "started",
        progress: 45,
        queue: "app.tasks.ai.transcribe_project"
      })
      .mockResolvedValueOnce({
        jobId: "job-transcribe",
        projectId: "project-2",
        state: "success",
        progress: 100,
        queue: "app.tasks.ai.transcribe_project"
      });

    fetchProject
      .mockResolvedValueOnce({
        ...baseProject,
        status: "transcribing",
        transcriptStatus: "in_progress",
        translationStatus: "not_started",
        dubbingStatus: "not_started",
        transcriptSegments: [],
        activeJob: {
          jobId: "job-transcribe",
          projectId: "project-2",
          state: "started",
          progress: 45,
          queue: "app.tasks.ai.transcribe_project"
        }
      })
      .mockResolvedValueOnce({
        ...baseProject,
        status: "transcribed",
        transcriptStatus: "ready",
        translationStatus: "not_started",
        dubbingStatus: "not_started",
        activeJob: null
      });

    render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "transcription_queued",
          transcriptStatus: "queued",
          translationStatus: "not_started",
          dubbingStatus: "not_started",
          transcriptSegments: [],
          activeJob: {
            jobId: "job-transcribe",
            projectId: "project-2",
            state: "queued",
            progress: 0,
            queue: "app.tasks.ai.transcribe_project"
          }
        } as typeof baseProject & { activeJob: unknown }}
        queue={queue}
      />
    );

    expect(screen.getByText(/processing now/i)).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-spinner")).toBeInTheDocument();
    expect(screen.getAllByText(/0% complete/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/elapsed 00:00/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(fetchJob).toHaveBeenCalledWith("job-transcribe");
    expect(fetchProject).toHaveBeenCalledWith("project-2");
    expect(screen.getAllByText(/45% complete/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/elapsed 00:01/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(fetchJob).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /start translation/i })).toBeInTheDocument();
  }, 10000);

  it("routes failed stages to explicit retry actions", () => {
    const { rerender } = render(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "transcription_failed",
          transcriptStatus: "failed",
          translationStatus: "not_started",
          dubbingStatus: "not_started",
        }}
        queue={queue}
      />
    );

    expect(screen.getByRole("button", { name: /retry transcription/i })).toBeInTheDocument();

    rerender(
      <TheaterShell
        currentProjectId="project-2"
        project={{
          ...baseProject,
          status: "translation_failed",
          transcriptStatus: "ready",
          translationStatus: "failed",
          dubbingStatus: "not_started",
        }}
        queue={queue}
      />
    );

    expect(screen.getByRole("button", { name: /retry translation/i })).toBeInTheDocument();
  });
});
