import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LibraryShell } from "@/components/library/library-shell";

const sampleLibrary = {
  folders: [
    { id: "folder-1", name: "Favorites", projectIds: ["project-1"] },
    { id: "folder-2", name: "Archive", projectIds: [] }
  ],
  playlists: [
    {
      id: "playlist-1",
      name: "Morning Watch",
      items: [{ projectId: "project-2", position: 1 }]
    }
  ],
  projects: [
    {
      id: "project-1",
      name: "Freepik 03",
      status: "transcribed",
      sourceType: "upload" as const,
      sourceUrl: "/storage/uploads/project-1/video.mp4",
      folderId: "folder-1",
      sourceLanguage: "en",
      targetLanguage: "pl",
      transcriptStatus: "ready",
      translationStatus: "not_started",
      dubbingStatus: "not_started",
      nextAction: "translate" as const
    },
    {
      id: "project-2",
      name: "Podcast teaser",
      status: "ready",
      sourceType: "url" as const,
      sourceUrl: "https://example.com/video",
      folderId: null,
      sourceLanguage: "pl",
      targetLanguage: "en",
      transcriptStatus: "ready",
      translationStatus: "ready",
      dubbingStatus: "not_started",
      nextAction: "open_theater" as const
    }
  ]
};

describe("LibraryShell", () => {
  it("renders a task-first intake, project actions, and a secondary organization panel", async () => {
    const user = userEvent.setup();

    render(<LibraryShell initialData={sampleLibrary} />);

    expect(screen.getByRole("heading", { name: /new project/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/source language/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target language/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /project tasks/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /organize library/i })).toBeInTheDocument();

    const freepikCard = screen.getByRole("article", { name: /freepik 03/i });
    expect(within(freepikCard).getByText("EN -> PL")).toBeInTheDocument();
    expect(within(freepikCard).getByRole("button", { name: /translate/i })).toBeInTheDocument();

    const podcastCard = screen.getByRole("article", { name: /podcast teaser/i });
    expect(within(podcastCard).getByText("PL -> EN")).toBeInTheDocument();
    expect(within(podcastCard).getByRole("link", { name: /open theater/i })).toHaveAttribute(
      "href",
      "/theater/playlist-1/project-2"
    );

    await user.click(within(freepikCard).getByRole("button", { name: /organize freepik 03/i }));

    expect(screen.getByLabelText(/folder target/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/playlist target/i)).toBeInTheDocument();
  });
});
