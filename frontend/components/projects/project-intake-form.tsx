"use client";

import clsx from "clsx";
import React, { useState } from "react";

type ProjectIntakeFormProps = {
  onUploadFile: (name: string, file: File) => Promise<void>;
  onImportUrl: (name: string, sourceUrl: string) => Promise<void>;
};

const modeCopy = {
  upload: {
    eyebrow: "Direct upload",
    title: "Bring in a local master",
    description: "Best for edits, exports, and files you already have on disk.",
    cta: "Add upload to library"
  },
  url: {
    eyebrow: "Remote ingest",
    title: "Pull from a video URL",
    description: "Use YouTube or public links and let the pipeline fetch the source for you.",
    cta: "Import link to library"
  }
} as const;

export function ProjectIntakeForm({ onUploadFile, onImportUrl }: ProjectIntakeFormProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "upload" && selectedFile) {
        await onUploadFile(name, selectedFile);
        setSelectedFile(null);
      }
      if (mode === "url") {
        await onImportUrl(name, sourceUrl);
        setSourceUrl("");
      }
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/80 shadow-panel backdrop-blur">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 bg-ink px-6 py-7 text-white lg:px-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-aqua">New project</p>
            <div className="space-y-2">
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-sand">
                Start a dubbing job without touching the backend.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-fog/80">
                Create a library-ready project, then jump straight into transcript, translation,
                dubbing, and export once the pipeline finishes.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {(["upload", "url"] as const).map((option) => (
              <button
                className={clsx(
                  "rounded-[1.5rem] border px-5 py-4 text-left transition",
                  mode === option
                    ? "border-aqua bg-aqua/15 shadow-[0_0_0_1px_rgba(82,209,198,0.25)]"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                )}
                key={option}
                onClick={() => setMode(option)}
                type="button"
              >
                <p className="text-[11px] uppercase tracking-[0.28em] text-aqua/90">
                  {modeCopy[option].eyebrow}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-sand">{modeCopy[option].title}</h3>
                <p className="mt-1 text-sm leading-6 text-fog/80">{modeCopy[option].description}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-3 text-sm text-fog/75 sm:grid-cols-3">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-fog/55">Formats</p>
              <p className="mt-2 font-medium text-white">MP4, MOV, MKV, WEBM</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-fog/55">Pipeline</p>
              <p className="mt-2 font-medium text-white">Transcript, translate, dub</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-fog/55">Ready for</p>
              <p className="mt-2 font-medium text-white">Desktop review and export</p>
            </div>
          </div>
        </div>

        <div className="bg-white px-6 py-7 lg:px-8">
          <form className="grid gap-5" noValidate onSubmit={handleSubmit}>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.26em] text-ember">Project details</p>
              <p className="text-sm text-ink/65">
                {mode === "upload"
                  ? "Add a clean source file and create a workspace entry."
                  : "Point DubbAI at a source URL and import it into the library."}
              </p>
            </div>

            <label className="grid gap-2 text-sm font-medium text-ink">
              <span>Project name</span>
              <input
                className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 text-ink outline-none transition focus:border-ember/50 focus:bg-white"
                onChange={(event) => setName(event.target.value)}
                placeholder="Launch teaser PL dub"
                required
                value={name}
              />
            </label>

            {mode === "upload" ? (
              <label className="grid gap-2 text-sm font-medium text-ink" key="upload">
                <span>Video file</span>
                <span className="rounded-[1.5rem] border border-dashed border-black/15 bg-sand/50 px-4 py-5 transition hover:border-ember/35 hover:bg-sand/70">
                  <input
                    accept=".mp4,.mov,.mkv,.webm"
                    aria-label="Video file"
                    className="sr-only"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    required
                    type="file"
                  />
                  <span className="block text-sm font-semibold text-ink">
                    {selectedFile ? selectedFile.name : "Choose a source file"}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-ink/60">
                    {selectedFile
                      ? `${Math.max(1, Math.round(selectedFile.size / 1024 / 1024))} MB selected`
                      : "Drop a master here or browse your machine."}
                  </span>
                </span>
              </label>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-ink" key="url">
                <span>Video URL</span>
                <input
                  aria-label="Video URL"
                  className="rounded-[1.25rem] border border-black/10 bg-sand/40 px-4 py-3 text-ink outline-none transition focus:border-ember/50 focus:bg-white"
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                  type="url"
                  value={sourceUrl}
                />
              </label>
            )}

            <div className="rounded-[1.5rem] border border-black/10 bg-ink/[0.03] px-4 py-4 text-sm text-ink/65">
              <p className="font-semibold text-ink">What happens next</p>
              <p className="mt-2 leading-6">
                The project is added to your library immediately. You can open the workspace,
                monitor status, and trigger transcript or dubbing jobs from there.
              </p>
            </div>

            <button
              className="rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b94d2b] disabled:opacity-60"
              disabled={isSubmitting || (mode === "upload" ? !selectedFile : !sourceUrl) || !name.trim()}
              type="submit"
            >
              {isSubmitting ? "Creating project..." : modeCopy[mode].cta}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
