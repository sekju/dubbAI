"use client";

import { create } from "zustand";

import type { ProjectSummary, TranscriptCue } from "@/lib/types";

type ProjectState = {
  activeProjectId: string | null;
  projects: ProjectSummary[];
  cues: TranscriptCue[];
  setProjects: (projects: ProjectSummary[]) => void;
  setActiveProject: (projectId: string) => void;
  setCues: (cues: TranscriptCue[]) => void;
};

export const useProjectStore = create<ProjectState>((set) => ({
  activeProjectId: null,
  projects: [],
  cues: [],
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  setCues: (cues) => set({ cues })
}));
