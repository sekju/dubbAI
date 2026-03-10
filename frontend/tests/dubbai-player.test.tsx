import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DubbAIPlayer } from "@/components/player/dubbai-player";
import { usePlayerStore } from "@/store/use-player-store";

const sampleCues = [
  {
    id: "cue-1",
    speaker: "Speaker A",
    originalText: "Hello world from the cinema mode",
    translatedText: "Czesc swiecie w trybie kinowym teraz",
    startMs: 0,
    endMs: 1200,
    words: [
      { text: "Hello", startMs: 0, endMs: 150 },
      { text: "world", startMs: 150, endMs: 300 },
      { text: "from", startMs: 300, endMs: 500 },
      { text: "the", startMs: 500, endMs: 700 },
      { text: "cinema", startMs: 700, endMs: 900 },
      { text: "mode", startMs: 900, endMs: 1200 }
    ]
  }
];

describe("DubbAIPlayer", () => {
  it("changes subtitle density output and skips empty dubbing audio sources", async () => {
    const user = userEvent.setup();
    usePlayerStore.setState({
      density: "balanced",
      subtitleMode: "dual",
      transcriptPanelOpen: true,
      karaokeEnabled: true,
      originalVolume: 40,
      dubbingVolume: 100,
      currentTimeMs: 250
    });

    const { container } = render(
      <DubbAIPlayer
        src="https://example.com/source.mp4"
        dubbingSrc={null}
        cues={sampleCues}
      />
    );

    expect(container.querySelector("audio")).toBeNull();
    expect(screen.getAllByText("Czesc swiecie w trybie kinowym teraz")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /compact/i }));
    fireEvent.change(screen.getByLabelText(/dubbing volume/i), { target: { value: "65" } });

    expect(usePlayerStore.getState().density).toBe("compact");
    expect(usePlayerStore.getState().dubbingVolume).toBe(65);
    expect(screen.getByText("Czesc swiecie w")).toBeInTheDocument();
    expect(screen.getAllByText("Czesc swiecie w trybie kinowym teraz")).toHaveLength(1);
  });
});
