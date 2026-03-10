import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { TheaterShell } from "@/components/theater/theater-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

const project = {
  id: "project-2",
  name: "Freepik 03",
  status: "transcribed",
  sourceType: "upload" as const,
  sourceUrl: "/storage/uploads/project-2/video.mp4",
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
  ]
};

const queue = {
  playlistId: "playlist-1",
  playlistName: "Morning Watch",
  items: [
    { projectId: "project-1", title: "Intro" },
    { projectId: "project-2", title: "Freepik 03" },
    { projectId: "project-3", title: "Finale" }
  ]
};

describe("TheaterShell", () => {
  it("keeps the playlist drawer hidden by default and navigates from the drawer", () => {
    const onNavigate = vi.fn();

    render(
      <TheaterShell
        currentProjectId="project-2"
        onNavigate={onNavigate}
        project={project}
        queue={queue}
      />
    );

    expect(screen.queryByText("Playlist drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /playlist/i }));

    expect(screen.getByText("Playlist drawer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open finale/i }));
    expect(onNavigate).toHaveBeenCalledWith("project-3");
  });

  it("keeps the theater layout clean in fullscreen mode", () => {
    render(
      <TheaterShell
        currentProjectId="project-2"
        fullscreen
        onNavigate={vi.fn()}
        project={project}
        queue={queue}
      />
    );

    expect(screen.getByTestId("theater-shell")).toHaveAttribute("data-fullscreen", "true");
    expect(screen.queryByRole("link", { name: /back to library/i })).not.toBeInTheDocument();
  });
});
