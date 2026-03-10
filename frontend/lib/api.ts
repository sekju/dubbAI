import type { JobStatus, ProjectSummary, TranscriptCue } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type ApiProject = {
  id: string;
  name: string;
  status: string;
  source_type: "upload" | "url";
  source_url: string | null;
  transcript_segments: Array<{
    speaker: string;
    start_ms: number;
    end_ms: number;
    original_text: string;
    translated_text: string;
    words: Array<{ text: string; start_ms: number; end_ms: number }>;
  }>;
};

type ApiJobStatus = {
  job_id: string;
  project_id: string;
  state: string;
  progress: number;
  queue: string;
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

function toProjectSummary(project: ApiProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    sourceType: project.source_type,
    sourceUrl: project.source_url,
    transcriptSegments: project.transcript_segments.map(toCue)
  };
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_URL}/api/projects`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load projects");
  }

  const projects = (await response.json()) as ApiProject[];

  return projects.map(toProjectSummary);
}

export async function fetchProject(projectId: string): Promise<ProjectSummary> {
  const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load project");
  }

  return toProjectSummary((await response.json()) as ApiProject);
}

export async function createProjectFromUpload(name: string, file: File): Promise<JobStatus> {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("file", file);

  const response = await fetch(`${API_URL}/api/projects/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Failed to upload project");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function createProjectFromUrl(name: string, sourceUrl: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/api/projects/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, source_url: sourceUrl })
  });

  if (!response.ok) {
    throw new Error("Failed to import project");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function startProjectTranscription(projectId: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/api/projects/${projectId}/transcribe`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to start transcription");
  }

  return toJobStatus((await response.json()) as ApiJobStatus);
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
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

  return `${API_URL}${sourceUrl}`;
}
