"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  addProjectToPlaylist,
  assignProjectToFolder,
  createFolder,
  createProjectFromUpload,
  createProjectFromUrl,
  createPlaylist,
  deleteProject,
  fetchLibrary,
  startProjectTranscription,
  startProjectTranslation
} from "@/lib/api";
import type {
  LibraryData,
  LibraryPlaylist,
  LibraryProjectNextAction,
  LibraryProjectSummary,
  ProjectIntakeLanguages
} from "@/lib/types";
import { ProjectIntakeForm } from "@/components/projects/project-intake-form";
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
  const [folderTargetId, setFolderTargetId] = useState<string>("");
  const [playlistTargetId, setPlaylistTargetId] = useState<string>("");
  const [pendingProjectActionIds, setPendingProjectActionIds] = useState<string[]>([]);
  const pendingProjectActionIdsRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    if (!folders.some((folder) => folder.id === folderTargetId)) {
      setFolderTargetId("");
    }
  }, [folderTargetId, folders]);

  useEffect(() => {
    if (!playlists.some((playlist) => playlist.id === playlistTargetId)) {
      setPlaylistTargetId("");
    }
  }, [playlistTargetId, playlists]);

  function updateProjects(nextProjects: LibraryProjectSummary[]) {
    setLibraryData({
      folders,
      playlists,
      projects: nextProjects
    });
  }

  function queueProjectStage(
    projectId: string,
    stage: "transcript" | "translation"
  ) {
    const canOpenTheater = getPlaylistForProject(projectId) !== null;

    updateProjects(
      projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        if (stage === "translation") {
          return {
            ...project,
            status: "translation_queued",
            translationStatus: "queued",
            nextAction: canOpenTheater ? "open_theater" : project.nextAction
          };
        }

        return {
          ...project,
          status: "transcription_queued",
          transcriptStatus: "queued",
          nextAction: canOpenTheater ? "open_theater" : project.nextAction
        };
      })
    );
  }

  async function handleCreateFolder() {
    const name = window.prompt("Folder name");
    if (!name?.trim()) {
      return;
    }

    const folder = await createFolder(name.trim());
    const nextFolders = [...folders, folder];
    setLibraryData({
      folders: nextFolders,
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
    const nextPlaylists = [...playlists, playlist];
    setLibraryData({
      folders,
      playlists: nextPlaylists,
      projects
    });
  }

  async function handleMoveToFolder() {
    if (!selectedProject || !folderTargetId) {
      return;
    }

    const updatedProject = await assignProjectToFolder(selectedProject.id, folderTargetId);
    const nextProjects = projects.map((project) =>
      project.id === selectedProject.id ? updatedProject : project
    );
    const nextFolders = folders.map((folder) => {
      const withoutProject = folder.projectIds.filter((projectId) => projectId !== selectedProject.id);

      if (folder.id === folderTargetId) {
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
    if (!selectedProject || !playlistTargetId) {
      return;
    }

    const updatedPlaylist = await addProjectToPlaylist(playlistTargetId, selectedProject.id);
    setLibraryData({
      folders,
      playlists: playlists.map((playlist) =>
        playlist.id === playlistTargetId ? updatedPlaylist : playlist
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

  async function refreshLibrary(nextSelectedProjectId?: string) {
    const nextLibrary = await fetchLibrary();
    selectFolder(null);
    selectPlaylist(null);
    setLibraryData(nextLibrary);

    if (nextSelectedProjectId) {
      setSelectedProjectId(nextSelectedProjectId);
    }
  }

  useEffect(() => {
    const hasRunningPipeline = projects.some(
      (project) =>
        project.transcriptStatus === "queued" ||
        project.transcriptStatus === "in_progress" ||
        project.translationStatus === "queued" ||
        project.translationStatus === "in_progress"
    );

    if (!hasRunningPipeline) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      const nextLibrary = await fetchLibrary();
      setLibraryData(nextLibrary);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [projects, setLibraryData]);

  async function handleUploadProject(name: string, file: File, options?: ProjectIntakeLanguages) {
    const job = await createProjectFromUpload(name, file, options);
    await refreshLibrary(job.projectId);
  }

  async function handleImportProject(
    name: string,
    sourceUrl: string,
    options?: ProjectIntakeLanguages
  ) {
    const job = await createProjectFromUrl(name, sourceUrl, options);
    await refreshLibrary(job.projectId);
  }

  function getPlaylistForProject(projectId: string): LibraryPlaylist | null {
    return playlists.find((playlist) => playlist.items.some((item) => item.projectId === projectId)) ?? null;
  }

  function resolveProjectAction(project: LibraryProjectSummary) {
    const nextAction = project.nextAction as LibraryProjectNextAction | undefined;

    if (nextAction === "open_theater") {
      const playlist = getPlaylistForProject(project.id);
      if (playlist) {
        return {
          type: "link" as const,
          href: `/theater/${playlist.id}/${project.id}`,
          label: "Open Theater"
        };
      }

      return {
        type: "disabled" as const,
        label: "Open Theater",
        hint: "Add this project to a playlist before launching Theater."
      };
    }

    if (pendingProjectActionIds.includes(project.id)) {
      return {
        type: "disabled" as const,
        label: "Starting...",
        hint: "This pipeline action is already being queued."
      };
    }

    if (project.translationStatus === "queued" || project.translationStatus === "in_progress") {
      return {
        type: "disabled" as const,
        label: project.translationStatus === "queued" ? "Translation queued" : "Translation running",
        hint: "Wait for translation to finish before starting another pipeline action."
      };
    }

    if (project.transcriptStatus === "queued" || project.transcriptStatus === "in_progress") {
      return {
        type: "disabled" as const,
        label: project.transcriptStatus === "queued" ? "Transcription queued" : "Transcription running",
        hint: "Wait for transcription to finish before starting another pipeline action."
      };
    }

    if (nextAction === "translate") {
      return { type: "button" as const, label: "Translate" };
    }

    if (nextAction === "retry") {
      return { type: "button" as const, label: "Retry" };
    }

    return { type: "button" as const, label: "Transcribe" };
  }

  async function handleRunProjectAction(project: LibraryProjectSummary) {
    if (pendingProjectActionIdsRef.current.has(project.id)) {
      return;
    }

    pendingProjectActionIdsRef.current.add(project.id);
    setPendingProjectActionIds((current) => [...current, project.id]);

    try {
      if (project.nextAction === "translate") {
        await startProjectTranslation(project.id);
        queueProjectStage(project.id, "translation");
        return;
      }

      if (project.nextAction === "retry") {
        if (project.translationStatus === "failed") {
          await startProjectTranslation(project.id);
          queueProjectStage(project.id, "translation");
          return;
        }

        await startProjectTranscription(project.id);
        queueProjectStage(project.id, "transcript");
        return;
      }

      if (project.nextAction === "transcribe") {
        await startProjectTranscription(project.id);
        queueProjectStage(project.id, "transcript");
      }
    } finally {
      pendingProjectActionIdsRef.current.delete(project.id);
      setPendingProjectActionIds((current) => current.filter((projectId) => projectId !== project.id));
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(82,209,198,0.22),transparent_24%),radial-gradient(circle_at_85%_12%,rgba(200,92,53,0.14),transparent_18%),linear-gradient(180deg,#f6efe2_0%,#edf3f7_100%)]">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:py-8">
        <div className="space-y-5">
          <ProjectIntakeForm onImportUrl={handleImportProject} onUploadFile={handleUploadProject} />
          <LibraryGrid
            onSelectProject={setSelectedProjectId}
            onRunProjectAction={handleRunProjectAction}
            projects={visibleProjects}
            resolveProjectAction={resolveProjectAction}
            selectedProjectId={selectedProjectId}
          />
        </div>
        <div className="space-y-5">
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
          <LibraryInspector
            folders={folders}
            folderTargetId={folderTargetId}
            onAddToPlaylist={handleAddToPlaylist}
            onDeleteProject={handleDeleteProject}
            onMoveToFolder={handleMoveToFolder}
            onSelectFolderTarget={setFolderTargetId}
            onSelectPlaylistTarget={setPlaylistTargetId}
            playlistTargetId={playlistTargetId}
            playlists={playlists}
            project={selectedProject}
          />
        </div>
      </div>
    </main>
  );
}
