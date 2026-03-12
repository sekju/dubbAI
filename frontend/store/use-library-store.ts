"use client";

import { create } from "zustand";

import type {
  LibraryData,
  LibraryQueueMetadata,
  LibrarySort,
  LibraryStatusFilter,
} from "@/lib/types";

type LibraryState = LibraryData & {
  activeFolderId: string | null;
  activePlaylistId: string | null;
  filters: {
    search: string;
    status: LibraryStatusFilter;
  };
  sort: LibrarySort;
  queueMetadata: LibraryQueueMetadata | null;
  setLibraryData: (data: LibraryData) => void;
  selectFolder: (folderId: string | null) => void;
  selectPlaylist: (playlistId: string | null) => void;
  setSearch: (search: string) => void;
  setStatusFilter: (status: LibraryStatusFilter) => void;
  setSort: (sort: LibrarySort) => void;
  setQueueMetadata: (metadata: LibraryQueueMetadata | null) => void;
};

export const useLibraryStore = create<LibraryState>((set) => ({
  folders: [],
  playlists: [],
  projects: [],
  activeFolderId: null,
  activePlaylistId: null,
  filters: {
    search: "",
    status: "all",
  },
  sort: "name-asc",
  queueMetadata: null,
  setLibraryData: ({ folders, playlists, projects }) => set({ folders, playlists, projects }),
  selectFolder: (activeFolderId) =>
    set({
      activeFolderId,
      activePlaylistId: null,
    }),
  selectPlaylist: (activePlaylistId) =>
    set({
      activeFolderId: null,
      activePlaylistId,
    }),
  setSearch: (search) =>
    set((state) => ({
      filters: {
        ...state.filters,
        search,
      },
    })),
  setStatusFilter: (status) =>
    set((state) => ({
      filters: {
        ...state.filters,
        status,
      },
    })),
  setSort: (sort) => set({ sort }),
  setQueueMetadata: (queueMetadata) => set({ queueMetadata }),
}));
