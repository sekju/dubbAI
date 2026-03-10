import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProjectWorkspace } from "@/components/projects/project-workspace";

const fetchProject = vi.fn();
const fetchJob = vi.fn();
const startProjectTranscription = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchProject: (...args: unknown[]) => fetchProject(...args),
  fetchJob: (...args: unknown[]) => fetchJob(...args),
  resolveMediaUrl: (sourceUrl: string | null | undefined) => sourceUrl ?? null,
  startProjectTranscription: (...args: unknown[]) => startProjectTranscription(...args)
}));

describe("ProjectWorkspace", () => {
  afterEach(() => {
    vi.useRealTimers();
    fetchProject.mockReset();
    fetchJob.mockReset();
    startProjectTranscription.mockReset();
  });

  it("offers a transcription action when the project has no transcript yet", async () => {
    const user = userEvent.setup();

    fetchProject.mockResolvedValue({
      id: "project-1",
      name: "Demo",
      status: "uploaded",
      sourceType: "upload",
      sourceUrl: "/storage/uploads/project-1/demo.mp4",
      transcriptSegments: []
    });
    startProjectTranscription.mockResolvedValue({
      jobId: "job-1",
      projectId: "project-1",
      state: "queued",
      progress: 0,
      queue: "app.tasks.ai.transcribe_project"
    });

    render(<ProjectWorkspace projectId="project-1" />);

    await screen.findByText("Demo");
    await user.click(screen.getByRole("button", { name: /start transcription/i }));

    await waitFor(() => expect(startProjectTranscription).toHaveBeenCalledWith("project-1"));
  });

  it("polls the queued job and reloads transcript data after success", async () => {
    const user = userEvent.setup();

    fetchProject
      .mockResolvedValueOnce({
        id: "project-1",
        name: "Demo",
        status: "uploaded",
        sourceType: "upload",
        sourceUrl: "/storage/uploads/project-1/demo.mp4",
        transcriptSegments: []
      })
      .mockResolvedValueOnce({
        id: "project-1",
        name: "Demo",
        status: "transcribed",
        sourceType: "upload",
        sourceUrl: "/storage/uploads/project-1/demo.mp4",
        transcriptSegments: [
          {
            id: "seg-1",
            speaker: "Speaker A",
            originalText: "Hello world",
            translatedText: "Czesc swiecie w trybie kinowym teraz",
            startMs: 0,
            endMs: 1200,
            words: []
          }
        ]
      });
    startProjectTranscription.mockResolvedValue({
      jobId: "job-1",
      projectId: "project-1",
      state: "queued",
      progress: 0,
      queue: "app.tasks.ai.transcribe_project"
    });
    fetchJob.mockResolvedValue({
      jobId: "job-1",
      projectId: "project-1",
      state: "success",
      progress: 100,
      queue: "app.tasks.ai.transcribe_project"
    });

    render(<ProjectWorkspace projectId="project-1" />);

    await screen.findByText("Demo");
    await user.click(screen.getByRole("button", { name: /start transcription/i }));

    await waitFor(() => expect(fetchJob).toHaveBeenCalledWith("job-1"), { timeout: 4000 });
    await waitFor(() => expect(fetchProject).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect((await screen.findAllByText("Czesc swiecie w trybie kinowym teraz")).length).toBeGreaterThan(0);
  }, 10000);
});
