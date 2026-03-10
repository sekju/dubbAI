export type SubtitleDensity = "compact" | "balanced" | "sentence";

export type TranscriptWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TranscriptCue = {
  id: string;
  speaker: string;
  originalText: string;
  translatedText: string;
  startMs: number;
  endMs: number;
  words: TranscriptWord[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  sourceType: "upload" | "url";
  sourceUrl?: string | null;
  transcriptSegments: TranscriptCue[];
};

export type LibraryProjectSummary = {
  id: string;
  name: string;
  status: string;
  sourceType: "upload" | "url";
  sourceUrl?: string | null;
  folderId?: string | null;
};

export type LibraryFolder = {
  id: string;
  name: string;
  projectIds: string[];
};

export type LibraryPlaylistItem = {
  projectId: string;
  position: number;
};

export type LibraryPlaylist = {
  id: string;
  name: string;
  items: LibraryPlaylistItem[];
};

export type LibraryData = {
  folders: LibraryFolder[];
  playlists: LibraryPlaylist[];
  projects: LibraryProjectSummary[];
};

export type LibraryStatusFilter =
  | "all"
  | "uploaded"
  | "queued"
  | "transcription_queued"
  | "transcribed"
  | "failed";

export type LibrarySort = "name-asc" | "name-desc" | "updated-desc";

export type LibraryQueueMetadata = {
  playlistId: string;
  projectIds: string[];
  currentProjectId: string;
};

export type TheaterQueueItem = {
  projectId: string;
  title: string;
};

export type TheaterQueue = {
  playlistId: string;
  playlistName: string;
  items: TheaterQueueItem[];
};

export type JobStatus = {
  jobId: string;
  projectId: string;
  state: "queued" | "started" | "retry" | "success" | "failure";
  progress: number;
  queue: string;
};
