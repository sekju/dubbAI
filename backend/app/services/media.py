from __future__ import annotations

from pathlib import Path

import ffmpeg


def extract_audio(source_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    (
        ffmpeg.input(str(source_path))
        .output(str(output_path), ac=1, ar=16000, format="wav")
        .overwrite_output()
        .run(quiet=True)
    )
    return output_path


def render_video_with_mix(
    source_video: Path,
    mixed_audio: Path,
    output_video: Path,
    subtitles_path: Path | None = None,
) -> Path:
    output_video.parent.mkdir(parents=True, exist_ok=True)
    stream = ffmpeg.input(str(source_video))
    audio_stream = ffmpeg.input(str(mixed_audio))
    kwargs = {"vcodec": "copy", "acodec": "aac", "preset": "veryfast", "shortest": None}
    if subtitles_path:
        stream = stream.filter("subtitles", str(subtitles_path))
        kwargs["vcodec"] = "libx264"
    (
        ffmpeg.output(stream, audio_stream.audio, str(output_video), **kwargs)
        .overwrite_output()
        .run(quiet=True)
    )
    return output_video
