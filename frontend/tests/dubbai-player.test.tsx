import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import { usePlayerStore } from "@/store/use-player-store";

const playMock = vi.fn().mockResolvedValue(undefined);
const pauseMock = vi.fn();
const requestFullscreenMock = vi.fn();
const exitFullscreenMock = vi.fn();

const sampleTranscriptWords = [
  {
    position: 1,
    startMs: 0,
    endMs: 500,
    originalText: "Hello",
    translatedText: "Pierwszy",
    keyword: false
  },
  {
    position: 2,
    startMs: 501,
    endMs: 1200,
    originalText: "world.",
    translatedText: "napis.",
    keyword: true
  },
  {
    position: 3,
    startMs: 1201,
    endMs: 1800,
    originalText: "Next",
    translatedText: "Drugi",
    keyword: false
  },
  {
    position: 4,
    startMs: 1801,
    endMs: 2400,
    originalText: "line.",
    translatedText: "wiersz.",
    keyword: false
  },
];

describe("DubbAIPlayer", () => {
  beforeEach(() => {
    let fullscreenElement: Element | null = null;

    vi.useFakeTimers();
    playMock.mockClear();
    pauseMock.mockClear();
    requestFullscreenMock.mockClear();
    exitFullscreenMock.mockClear();

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playMock
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pauseMock
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreenMock.mockImplementation(function requestFullscreen(this: Element) {
        fullscreenElement = this;
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          get: () => fullscreenElement
        });
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      })
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreenMock.mockImplementation(() => {
        fullscreenElement = null;
        Object.defineProperty(document, "fullscreenElement", {
          configurable: true,
          get: () => fullscreenElement
        });
        document.dispatchEvent(new Event("fullscreenchange"));
        return Promise.resolve();
      })
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement
    });

    usePlayerStore.setState({
      density: "balanced",
      primaryTrack: "translation",
      secondaryTrack: "original",
      primaryTiktokMode: false,
      secondaryTiktokMode: false,
      currentTimeMs: 0,
      durationMs: 0,
      isPlaying: false,
      volume: 80,
      playbackRate: 1,
      autoplay: true,
      isFullscreen: false,
      overlayVisible: true,
      settingsOpen: false
    } as Partial<ReturnType<typeof usePlayerStore.getState>>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses custom controls, keyboard shortcuts, and time-driven cue switching", async () => {
    render(<DubbAIPlayer src="https://example.com/source.mp4" transcriptWords={sampleTranscriptWords} />);

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).not.toHaveAttribute("controls");
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByTestId("subtitle-primary")).toHaveTextContent("Pierwszy napis.");
    expect(screen.getByTestId("subtitle-secondary")).toHaveTextContent("Hello world.");
    expect(screen.getByTestId("subtitle-primary-word-2")).toHaveAttribute("data-keyword", "true");

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(playMock).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "k" });
    expect(pauseMock).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "l" });
    expect(usePlayerStore.getState().currentTimeMs).toBe(15000);

    act(() => {
      Object.defineProperty(video, "currentTime", { configurable: true, value: 0.8, writable: true });
      Object.defineProperty(video, "duration", { configurable: true, value: 24 });
      fireEvent.loadedMetadata(video);
      fireEvent.timeUpdate(video);
    });

    expect(screen.getByTestId("subtitle-primary-word-2")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("subtitle-primary")).toHaveTextContent("Pierwszy napis.");
    expect(screen.getByTestId("subtitle-secondary")).toHaveTextContent("Hello world.");
    expect(usePlayerStore.getState().durationMs).toBe(24000);
  });

  it("supports primary and secondary track assignment plus swap without changing single-line slot styling", () => {
    render(<DubbAIPlayer src="https://example.com/source.mp4" transcriptWords={sampleTranscriptWords} />);

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    const primarySubtitle = screen.getByTestId("subtitle-primary");
    const translationClassName = primarySubtitle.className;

    fireEvent.click(screen.getByRole("button", { name: /primary original/i }));
    expect(primarySubtitle).toHaveTextContent("Hello world");
    expect(primarySubtitle.className).toBe(translationClassName);

    fireEvent.click(screen.getByRole("button", { name: /secondary off/i }));
    expect(screen.queryByTestId("subtitle-secondary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /primary translation/i }));
    fireEvent.click(screen.getByRole("button", { name: /secondary original/i }));
    fireEvent.click(screen.getByRole("button", { name: /swap tracks/i }));

    expect(screen.getByTestId("subtitle-primary")).toHaveTextContent("Hello world");
    expect(screen.getByTestId("subtitle-secondary")).toHaveTextContent("Pierwszy napis");
  });

  it("hides overlay on inactivity, keeps queue controls, and uses the real fullscreen API", async () => {
    const onAutoplayNext = vi.fn();

    render(
      <DubbAIPlayer
        onAutoplayNext={onAutoplayNext}
        src="https://example.com/source.mp4"
        transcriptWords={sampleTranscriptWords}
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fullscreen/i }));
    });

    expect(requestFullscreenMock).toHaveBeenCalled();
    expect(usePlayerStore.getState().isFullscreen).toBe(true);

    await act(async () => {
      fireEvent.keyDown(window, { key: "f" });
    });

    expect(exitFullscreenMock).toHaveBeenCalled();
    expect(usePlayerStore.getState().isFullscreen).toBe(false);

    fireEvent.ended(video);
    expect(onAutoplayNext).toHaveBeenCalledTimes(1);
  });

  it("supports independent tiktok mode toggles for primary and secondary tracks", () => {
    render(<DubbAIPlayer src="https://example.com/source.mp4" transcriptWords={sampleTranscriptWords} />);

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));

    const primaryWord = screen.getByTestId("subtitle-primary-word-2");
    const secondaryWord = screen.getByTestId("subtitle-secondary-word-2");

    expect(primaryWord).toHaveAttribute("data-tiktok", "false");
    expect(secondaryWord).toHaveAttribute("data-tiktok", "false");

    fireEvent.click(screen.getByRole("button", { name: /primary tiktok/i }));
    expect(usePlayerStore.getState().primaryTiktokMode).toBe(true);
    expect(screen.getByTestId("subtitle-primary-word-2")).toHaveAttribute("data-tiktok", "true");
    expect(screen.getByTestId("subtitle-secondary-word-2")).toHaveAttribute("data-tiktok", "false");

    fireEvent.click(screen.getByRole("button", { name: /secondary tiktok/i }));
    expect(usePlayerStore.getState().secondaryTiktokMode).toBe(true);
    expect(screen.getByTestId("subtitle-secondary-word-2")).toHaveAttribute("data-tiktok", "true");
  });
});
