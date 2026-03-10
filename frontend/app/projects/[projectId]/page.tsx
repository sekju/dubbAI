import { redirect } from "next/navigation";

import { fetchLibrary } from "@/lib/api";

export default async function ProjectCompatibilityPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const library = await fetchLibrary();
  const playlist = library.playlists.find((entry) =>
    entry.items.some((item) => item.projectId === projectId)
  );

  if (playlist) {
    redirect(`/theater/${playlist.id}/${projectId}`);
  }

  redirect(`/library?projectId=${projectId}`);
}
