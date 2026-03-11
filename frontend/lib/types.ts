export type SubtitleDensity = "compact" | "balanced" | "sentence";

export type PipelineStageStatus = "not_started" | "queued" | "in_progress" | "ready" | "failed";

export type LibraryProjectNextAction = "transcribe" | "translate" | "open_theater" | "retry";

export type TranscriptCueWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TranscriptWord = {
  position: number;
  startMs: number;
  endMs: number;
  originalText: string;
  translatedText: string;
  keyword: boolean;
};

export type TranscriptWordTrack = "original" | "translation";

export type GroupedTranscriptWords = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: TranscriptWord[];
};

export type TranscriptWordGroup = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
};

export type TranscriptCue = {
  id: string;
  speaker: string;
  originalText: string;
  translatedText: string;
  startMs: number;
  endMs: number;
  words: TranscriptCueWord[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  sourceType: "upload" | "url";
  sourceUrl?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  transcriptStatus?: PipelineStageStatus;
  translationStatus?: PipelineStageStatus;
  dubbingStatus?: PipelineStageStatus;
  activeJob?: JobStatus | null;
  transcriptSegments: TranscriptCue[];
  transcriptWords: TranscriptWord[];
};

export type TranscriptTrackSource = "original" | "translation";

export type RenderedTranscriptGroup = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  words: TranscriptWord[];
  track: TranscriptTrackSource;
};

export type LibraryProjectSummary = {
  id: string;
  name: string;
  status: string;
  sourceType: "upload" | "url";
  sourceUrl?: string | null;
  folderId?: string | null;
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
  transcriptStatus?: PipelineStageStatus;
  translationStatus?: PipelineStageStatus;
  dubbingStatus?: PipelineStageStatus;
  nextAction?: LibraryProjectNextAction;
  activeJob?: JobStatus | null;
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

export type ProjectIntakeLanguages = {
  sourceLanguage?: string | null;
  targetLanguage?: string | null;
};
