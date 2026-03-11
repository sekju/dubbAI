import type {
  JobStatus,
  LibraryData,
  LibraryFolder,
  LibraryProjectNextAction,
  LibraryPlaylist,
  LibraryProjectSummary,
  PipelineStageStatus,
  ProjectSummary,
  ProjectIntakeLanguages,
  TheaterQueue,
  TranscriptCue,
} from "@/lib/types";

export function getApiBaseUrl(options?: { isServer?: boolean }): string {
  const isServer = options?.isServer ?? typeof window === "undefined";

  if (isServer && process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  return process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? "http://localhost:8000";
}

type ApiProject = {
  id: string;
  name: string;
  status: string;
  source_type: "upload" | "url";
  source_url: string | null;
  source_language?: string | null;
  target_language?: string | null;
  transcript_status?: string;
  translation_status?: string;
  dubbing_status?: string;
  active_job?: ApiJobStatus | null;
  transcript_segments: Array<{
    speaker: string;
    start_ms: number;
    end_ms: number;
    original_text: string;
    translated_text: string;
    words: Array<{ text: string; start_ms: number; end_ms: number }>;
  }>;
  transcript_words: Array<{
    position: number;
    start_ms: number;
    end_ms: number;
    original_text: string;
    translated_text: string;
    keyword: boolean;
  }>;
};

type ApiJobStatus = {
  job_id: string;
  project_id: string;
  state: string;
  progress: number;
  queue: string;
};

type ApiLibraryProject = {
  id: string;
  name: string;
  status: string;
  source_type: "upload" | "url";
  source_url: string | null;
  folder_id: string | null;
  source_language?: string | null;
  target_language?: string | null;
  transcript_status?: string;
  translation_status?: string;
  dubbing_status?: string;
  next_action?: LibraryProjectNextAction;
  active_job?: ApiJobStatus | null;
};

type ApiFolder = {
  id: string;
  name: string;
  project_ids: string[];
};

type ApiPlaylist = {
  id: string;
  name: string;
  items: Array<{
    project_id: string;
    position: number;
  }>;
};

type ApiLibrary = {
  folders: ApiFolder[];
  playlists: ApiPlaylist[];
  projects: ApiLibraryProject[];
};

function toJobStatus(job: ApiJobStatus): JobStatus {
  return {
    jobId: job.job_id,
    projectId: job.project_id,
    state: job.state as JobStatus["state"],
    progress: job.progress,
    queue: job.queue
  };
}

function toCue(segment: ApiProject["transcript_segments"][number], index: number): TranscriptCue {
  return {
    id: `${segment.speaker}-${segment.start_ms}-${index}`,
    speaker: segment.speaker,
    originalText: segment.original_text,
    translatedText: segment.translated_text,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
    words: segment.words.map((word) => ({
      text: word.text,
      startMs: word.start_ms,
      endMs: word.end_ms
    }))
  };
}

function toStageStatus(status?: string | null): PipelineStageStatus | undefined {
  if (!status) {
    return undefined;
  }

  if (status === "not_started" || status === "queued" || status === "in_progress" || status === "ready" || status === "failed") {
    return status;
  }

  return undefined;
}

function toProjectSummary(project: ApiProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    sourceType: project.source_type,
    sourceUrl: project.source_url,
    sourceLanguage: project.source_language,
    targetLanguage: project.target_language,
    transcriptStatus: toStageStatus(project.transcript_status),
    translationStatus: toStageStatus(project.translation_status),
    dubbingStatus: toStageStatus(project.dubbing_status),
    activeJob: project.active_job ? toJobStatus(project.active_job) : null,
    transcriptSegments: project.transcript_segments.map(toCue),
    transcriptWords: project.transcript_words.map((word) => ({
      position: word.position,
      startMs: word.start_ms,
      endMs: word.end_ms,
      originalText: word.original_text,
      translatedText: word.translated_text,
      keyword: word.keyword
    }))
  };
}

function toLibraryProjectSummary(project: ApiLibraryProject): LibraryProjectSummary {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    sourceType: project.source_type,
    sourceUrl: project.source_url,
    folderId: project.folder_id,
    sourceLanguage: project.source_language,
    targetLanguage: project.target_language,
    transcriptStatus: toStageStatus(project.transcript_status),
    translationStatus: toStageStatus(project.translation_status),
    dubbingStatus: toStageStatus(project.dubbing_status),
    nextAction: project.next_action,
    activeJob: project.active_job ? toJobStatus(project.active_job) : null,
  };
}

function toLibraryFolder(folder: ApiFolder): LibraryFolder {
  return {
    id: folder.id,
    name: folder.name,
    projectIds: folder.project_ids,
  };
}

function toLibraryPlaylist(playlist: ApiPlaylist): LibraryPlaylist {
  return {
    id: playlist.id,
    name: playlist.name,
    items: playlist.items.map((item) => ({
      projectId: item.project_id,
      position: item.position,
    })),
  };
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load projects");
  }

  const projects = (await response.json()) as ApiProject[];

  return projects.map(toProjectSummary);
}

export async function fetchProject(projectId: string): Promise<ProjectSummary> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load project");
  }

  return toProjectSummary((await response.json()) as ApiProject);
}

export async function fetchLibrary(): Promise<LibraryData> {
  const response = await fetch(`${getApiBaseUrl()}/api/library`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load library");
  }

  const payload = (await response.json()) as ApiLibrary;

  return {
    folders: payload.folders.map(toLibraryFolder),
    playlists: payload.playlists.map(toLibraryPlaylist),
    projects: payload.projects.map(toLibraryProjectSummary),
  };
}

export async function fetchPlaylistQueue(playlistId: string): Promise<TheaterQueue> {
  const library = await fetchLibrary();
  const playlist = library.playlists.find((entry) => entry.id === playlistId);

  if (!playlist) {
    throw new Error("Playlist not found");
  }

  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    items: playlist.items.map((item) => {
      const project = library.projects.find((entry) => entry.id === item.projectId);

      return {
        projectId: item.projectId,
        title: project?.name ?? item.projectId,
      };
    }),
  };
}

export async function createProjectFromUpload(
  name: string,
  file: File,
  options?: ProjectIntakeLanguages,
): Promise<JobStatus> {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("file", file);
  if (options?.sourceLanguage) {
    formData.set("source_language", options.sourceLanguage);
  }
  if (options?.targetLanguage) {
    formData.set("target_language", options.targetLanguage);
  }
  if (options?.geminiModelText) {
    formData.set("gemini_model_text", options.geminiModelText);
  }
  if (options?.geminiThinkingMode) {
    formData.set("gemini_thinking_mode", options.geminiThinkingMode);
  }
  if (options?.geminiThinkingBudget != null) {
    formData.set("gemini_thinking_budget", String(options.geminiThinkingBudget));
  }
  if (options?.geminiMaxOutputTokens != null) {
    formData.set("gemini_max_output_tokens", String(options.geminiMaxOutputTokens));
  }
  if (options?.geminiStructuredOutput != null) {
    formData.set("gemini_structured_output", String(options.geminiStructuredOutput));
  }

  const response = await fetch(`${getApiBaseUrl()}/api/projects/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Failed to upload project");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function createProjectFromUrl(
  name: string,
  sourceUrl: string,
  options?: ProjectIntakeLanguages,
): Promise<JobStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      source_url: sourceUrl,
      source_language: options?.sourceLanguage ?? null,
      target_language: options?.targetLanguage ?? null,
      gemini_model_text: options?.geminiModelText ?? null,
      gemini_thinking_mode: options?.geminiThinkingMode ?? null,
      gemini_thinking_budget: options?.geminiThinkingBudget ?? null,
      gemini_max_output_tokens: options?.geminiMaxOutputTokens ?? null,
      gemini_structured_output: options?.geminiStructuredOutput ?? null
    })
  });

  if (!response.ok) {
    throw new Error("Failed to import project");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function createFolder(name: string): Promise<LibraryFolder> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Failed to create folder");
  }

  return toLibraryFolder((await response.json()) as ApiFolder);
}

export async function createPlaylist(name: string): Promise<LibraryPlaylist> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/playlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Failed to create playlist");
  }

  return toLibraryPlaylist((await response.json()) as ApiPlaylist);
}

export async function assignProjectToFolder(
  projectId: string,
  folderId: string,
): Promise<LibraryProjectSummary> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/projects/${projectId}/folder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folder_id: folderId }),
  });

  if (!response.ok) {
    throw new Error("Failed to assign project to folder");
  }

  return toLibraryProjectSummary((await response.json()) as ApiLibraryProject);
}

export async function addProjectToPlaylist(
  playlistId: string,
  projectId: string,
): Promise<LibraryPlaylist> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/playlists/${playlistId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!response.ok) {
    throw new Error("Failed to add project to playlist");
  }

  return toLibraryPlaylist((await response.json()) as ApiPlaylist);
}

export async function reorderPlaylistItems(
  playlistId: string,
  projectIds: string[],
): Promise<LibraryPlaylist> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/playlists/${playlistId}/items/reorder`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project_ids: projectIds }),
  });

  if (!response.ok) {
    throw new Error("Failed to reorder playlist");
  }

  return toLibraryPlaylist((await response.json()) as ApiPlaylist);
}

export async function removeProjectFromPlaylist(
  playlistId: string,
  projectId: string,
): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/library/playlists/${playlistId}/items/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to remove project from playlist");
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to delete project");
  }
}

export async function startProjectTranscription(projectId: string): Promise<JobStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/transcribe`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to start transcription");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function startProjectTranslation(projectId: string): Promise<JobStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/projects/${projectId}/translate`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to start translation");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/jobs/${jobId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load job");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export function resolveMediaUrl(sourceUrl?: string | null): string | null {
  if (!sourceUrl) {
    return null;
  }

  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    return sourceUrl;
  }

  return `${getApiBaseUrl()}${sourceUrl}`;
}
