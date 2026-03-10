import React from "react";
import { render, screen } from "@testing-library/react";

import { ProjectDashboard } from "@/components/projects/project-dashboard";

const fetchProjects = vi.fn();
const createProjectFromUpload = vi.fn();
const createProjectFromUrl = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchProjects: (...args: unknown[]) => fetchProjects(...args),
  createProjectFromUpload: (...args: unknown[]) => createProjectFromUpload(...args),
  createProjectFromUrl: (...args: unknown[]) => createProjectFromUrl(...args)
}));

describe("ProjectDashboard", () => {
  it("renders a polished library overview for existing projects", async () => {
    fetchProjects.mockResolvedValue([
      {
        id: "project-1",
        name: "Campaign master",
        status: "transcribed",
        sourceType: "upload",
        sourceUrl: "/storage/uploads/project-1/demo.mp4",
        transcriptSegments: [{ id: "seg-1" }]
      },
      {
        id: "project-2",
        name: "Podcast teaser",
        status: "transcription_queued",
        sourceType: "url",
        sourceUrl: "https://example.com/video",
        transcriptSegments: []
      }
    ]);

    render(<ProjectDashboard />);

    expect((await screen.findAllByText("Project library")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 active projects")).toHaveLength(2);
    expect(screen.getByText("Campaign master")).toBeInTheDocument();
    expect(screen.getByText("Podcast teaser")).toBeInTheDocument();
    expect(screen.getAllByText("Open workspace")).toHaveLength(2);
  });
});
