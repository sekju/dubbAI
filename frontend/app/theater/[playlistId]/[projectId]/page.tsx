import { redirect } from "next/navigation";

import { TheaterShell } from "@/components/theater/theater-shell";
import { fetchPlaylistQueue, fetchProject } from "@/lib/api";

export default async function TheaterProjectPage({
  params
}: {
  params: Promise<{ playlistId: string; projectId: string }>;
}) {
  const { playlistId, projectId } = await params;
  const queue = await fetchPlaylistQueue(playlistId);

  if (!queue.items.some((item) => item.projectId === projectId)) {
    const fallbackProjectId = queue.items[0]?.projectId;
    redirect(fallbackProjectId ? `/theater/${playlistId}/${fallbackProjectId}` : "/library");
    return null;
  }

  const project = await fetchProject(projectId);

  return <TheaterShell currentProjectId={projectId} project={project} queue={queue} />;
}
