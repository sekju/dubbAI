import { TheaterShell } from "@/components/theater/theater-shell";
import { fetchPlaylistQueue, fetchProject } from "@/lib/api";

export default async function TheaterProjectPage({
  params
}: {
  params: Promise<{ playlistId: string; projectId: string }>;
}) {
  const { playlistId, projectId } = await params;
  const [queue, project] = await Promise.all([
    fetchPlaylistQueue(playlistId),
    fetchProject(projectId)
  ]);

  return <TheaterShell currentProjectId={projectId} project={project} queue={queue} />;
}
