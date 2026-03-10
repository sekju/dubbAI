"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  addProjectToPlaylist,
  assignProjectToFolder,
  createFolder,
  createPlaylist,
  deleteProject
} from "@/lib/api";
import type { LibraryData, LibraryPlaylist, LibraryProjectSummary } from "@/lib/types";
import { useLibraryStore } from "@/store/use-library-store";

import { LibraryGrid } from "./library-grid";
import { LibraryInspector } from "./library-inspector";
import { LibrarySidebar } from "./library-sidebar";

type LibraryShellProps = {
  initialData: LibraryData;
};

function sortProjects(projects: LibraryProjectSummary[]) {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name));
}

export function LibraryShell({ initialData }: LibraryShellProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const {
    folders,
    playlists,
    projects,
    activeFolderId,
    activePlaylistId,
    setLibraryData,
    selectFolder,
    selectPlaylist
  } = useLibraryStore();

  useEffect(() => {
    setLibraryData(initialData);
  }, [initialData, setLibraryData]);

  const activePlaylist = useMemo<LibraryPlaylist | null>(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId, playlists]
  );

  const visibleProjects = useMemo(() => {
    let nextProjects = projects;

    if (activeFolderId) {
      const folder = folders.find((entry) => entry.id === activeFolderId);
      nextProjects = projects.filter((project) => folder?.projectIds.includes(project.id));
    }

    if (activePlaylist) {
      nextProjects = activePlaylist.items
        .map((item) => projects.find((project) => project.id === item.projectId) ?? null)
        .filter((project): project is LibraryProjectSummary => project !== null);
    }

    return sortProjects(nextProjects);
  }, [activeFolderId, activePlaylist, folders, projects]);

  const selectedProject =
    visibleProjects.find((project) => project.id === selectedProjectId) ??
    projects.find((project) => project.id === selectedProjectId) ??
    null;

  async function handleCreateFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) {
      return;
    }

    const folder = await createFolder(name.trim());
    setLibraryData({
      folders: [...folders, folder],
      playlists,
      projects
    });
  }

  async function handleCreatePlaylist() {
    const name = window.prompt("Playlist name");
    if (!name?.trim()) {
      return;
    }

    const playlist = await createPlaylist(name.trim());
    setLibraryData({
      folders,
      playlists: [...playlists, playlist],
      projects
    });
  }

  async function handleMoveToFolder() {
    if (!selectedProject || !activeFolderId) {
      return;
    }

    const updatedProject = await assignProjectToFolder(selectedProject.id, activeFolderId);
    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id ? updatedProject : project
    );
    const nextFolders = folders.map((folder) => {
      const withoutProject = folder.projectIds.filter((projectId) => projectId !== selectedProject.id);

      if (folder.id === activeFolderId) {
        return {
          ...folder,
          projectIds: [...withoutProject, selectedProject.id]
        };
      }

      return {
        ...folder,
        projectIds: withoutProject
      };
    });

    setLibraryData({
      folders: nextFolders,
      playlists,
      projects: nextProjects
    });
  }

  async function handleAddToPlaylist() {
    if (!selectedProject || !activePlaylistId) {
      return;
    }

    const updatedPlaylist = await addProjectToPlaylist(activePlaylistId, selectedProject.id);
    setLibraryData({
      folders,
      playlists: playlists.map((playlist) =>
        playlist.id === activePlaylistId ? updatedPlaylist : playlist
      ),
      projects
    });
  }

  async function handleDeleteProject() {
    if (!selectedProject) {
      return;
    }

    if (!window.confirm(`Delete ${selectedProject.name}?`)) {
      return;
    }

    await deleteProject(selectedProject.id);

    setLibraryData({
      folders: folders.map((folder) => ({
        ...folder,
        projectIds: folder.projectIds.filter((projectId) => projectId !== selectedProject.id)
      })),
      playlists: playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.filter((item) => item.projectId !== selectedProject.id)
      })),
      projects: projects.filter((project) => project.id !== selectedProject.id)
    });
    setSelectedProjectId(null);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(82,209,198,0.22),transparent_24%),radial-gradient(circle_at_85%_12%,rgba(200,92,53,0.14),transparent_18%),linear-gradient(180deg,#f6efe2_0%,#edf3f7_100%)]">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:px-8 lg:py-8">
        <LibrarySidebar
          activeFolderId={activeFolderId}
          activePlaylistId={activePlaylistId}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onCreatePlaylist={handleCreatePlaylist}
          onSelectFolder={selectFolder}
          onSelectPlaylist={selectPlaylist}
          playlists={playlists}
        />
        <LibraryGrid
          onSelectProject={setSelectedProjectId}
          projects={visibleProjects}
          selectedProjectId={selectedProjectId}
        />
        <LibraryInspector
          activeFolderId={activeFolderId}
          activePlaylistId={activePlaylistId}
          onAddToPlaylist={handleAddToPlaylist}
          onDeleteProject={handleDeleteProject}
          onMoveToFolder={handleMoveToFolder}
          playlist={activePlaylist}
          project={selectedProject}
        />
      </div>
    </main>
  );
}
