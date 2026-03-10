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

export type JobStatus = {
  jobId: string;
  projectId: string;
  state: "queued" | "started" | "retry" | "success" | "failure";
  progress: number;
  queue: string;
};
