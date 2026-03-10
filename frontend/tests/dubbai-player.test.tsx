import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import { usePlayerStore } from "@/store/use-player-store";

const playMock = vi.fn().mockResolvedValue(undefined);
const pauseMock = vi.fn();

const sampleCues = [
  {
    id: "cue-1",
    speaker: "Speaker A",
    originalText: "Hello world",
    translatedText: "Pierwszy napis",
    startMs: 0,
    endMs: 1200,
    words: []
  },
  {
    id: "cue-2",
    speaker: "Speaker A",
    originalText: "Next line",
    translatedText: "Drugi napis",
    startMs: 1201,
    endMs: 2400,
    words: []
  }
];

describe("DubbAIPlayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playMock.mockClear();
    pauseMock.mockClear();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playMock
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pauseMock
    });

    usePlayerStore.setState({
      density: "balanced",
      subtitleMode: "dual",
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      volume: 80,
      playbackRate: 1,
      autoplay: true,
      isFullscreen: false,
      overlayVisible: true,
      settingsOpen: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses custom controls, keyboard shortcuts, and time-driven cue switching", async () => {
    render(<DubbAIPlayer cues={sampleCues} src="https://example.com/source.mp4" />);

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).not.toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByText("Pierwszy napis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(playMock).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "k" });
    expect(pauseMock).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "l" });
    expect(usePlayerStore.getState().currentTimeMs).toBe(15000);

    act(() => {
      Object.defineProperty(video, "currentTime", { configurable: true, value: 1.8, writable: true });
      Object.defineProperty(video, "duration", { configurable: true, value: 24 });
      fireEvent.loadedMetadata(video);
      fireEvent.timeUpdate(video);
    });

    expect(screen.getByText("Drugi napis")).toBeInTheDocument();
    expect(usePlayerStore.getState().durationMs).toBe(24000);
  });

  it("hides overlay on inactivity, toggles settings, and calls autoplay next", async () => {
    const onAutoplayNext = vi.fn();

    render(
      <DubbAIPlayer
        cues={sampleCues}
        onAutoplayNext={onAutoplayNext}
        src="https://example.com/source.mp4"
      />
    );

    const video = document.querySelector("video") as HTMLVideoElement;
    const overlay = screen.getByTestId("player-overlay");
    expect(overlay).toHaveAttribute("data-state", "visible");

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(overlay).toHaveAttribute("data-state", "hidden");

    fireEvent.mouseMove(video);
    expect(overlay).toHaveAttribute("data-state", "visible");

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByText("Autoplay next")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /autoplay next/i }));
    expect(usePlayerStore.getState().autoplay).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /autoplay next/i }));
    expect(usePlayerStore.getState().autoplay).toBe(true);

    fireEvent.ended(video);
    expect(onAutoplayNext).toHaveBeenCalledTimes(1);
  });
});
