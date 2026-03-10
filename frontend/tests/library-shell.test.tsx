import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LibraryShell } from "@/components/library/library-shell";

const sampleLibrary = {
  folders: [
    { id: "folder-1", name: "Favorites", projectIds: ["project-1"] },
    { id: "folder-2", name: "Archive", projectIds: ["project-2"] }
  ],
  playlists: [
    {
      id: "playlist-1",
      name: "Morning Watch",
      items: [
        { projectId: "project-1", position: 1 },
        { projectId: "project-2", position: 2 }
      ]
    }
  ],
  projects: [
    {
      id: "project-1",
      name: "Freepik 03",
      status: "transcribed",
      sourceType: "upload" as const,
      sourceUrl: "/storage/uploads/project-1/video.mp4",
      folderId: "folder-1"
    },
    {
      id: "project-2",
      name: "Podcast teaser",
      status: "transcription_queued",
      sourceType: "url" as const,
      sourceUrl: "https://example.com/video",
      folderId: "folder-2"
    }
  ]
};

describe("LibraryShell", () => {
  it("shows folders and playlists, opens inspector, and links into Theater", async () => {
    const user = userEvent.setup();

    render(<LibraryShell initialData={sampleLibrary} />);

    expect(screen.getByRole("button", { name: /favorites/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /morning watch/i })).toBeInTheDocument();
    expect(screen.getByText("Freepik 03")).toBeInTheDocument();
    expect(screen.getByText("Podcast teaser")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /morning watch/i }));
    await user.click(screen.getByRole("button", { name: /select freepik 03/i }));

    expect(screen.getByText("Selected project")).toBeInTheDocument();
    const theaterLink = screen.getByRole("link", { name: /open in theater/i });
    expect(within(theaterLink.closest("aside") as HTMLElement).getByText("Freepik 03")).toBeInTheDocument();

    expect(theaterLink).toHaveAttribute("href", "/theater/playlist-1/project-1");
  });
});
