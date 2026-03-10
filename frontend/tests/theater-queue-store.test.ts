import { useTheaterQueueStore } from "@/store/use-theater-queue-store";

describe("useTheaterQueueStore", () => {
  beforeEach(() => {
    useTheaterQueueStore.setState({
      playlistId: null,
      items: [],
      currentIndex: 0,
      autoplay: true
    });
  });

  it("loads playlist items and selects the current project index", () => {
    useTheaterQueueStore.getState().loadQueue({
      playlistId: "playlist-1",
      currentProjectId: "project-2",
      items: [
        { projectId: "project-1", title: "Alpha" },
        { projectId: "project-2", title: "Beta" }
      ]
    });

    expect(useTheaterQueueStore.getState().playlistId).toBe("playlist-1");
    expect(useTheaterQueueStore.getState().currentIndex).toBe(1);
    expect(useTheaterQueueStore.getState().items).toHaveLength(2);
  });

  it("supports next and previous navigation", () => {
    useTheaterQueueStore.setState({
      playlistId: "playlist-1",
      items: [
        { projectId: "project-1", title: "Alpha" },
        { projectId: "project-2", title: "Beta" },
        { projectId: "project-3", title: "Gamma" }
      ],
      currentIndex: 1,
      autoplay: true
    });

    useTheaterQueueStore.getState().goNext();
    expect(useTheaterQueueStore.getState().currentIndex).toBe(2);

    useTheaterQueueStore.getState().goPrevious();
    expect(useTheaterQueueStore.getState().currentIndex).toBe(1);
  });

  it("toggles autoplay", () => {
    useTheaterQueueStore.getState().toggleAutoplay();
    expect(useTheaterQueueStore.getState().autoplay).toBe(false);
  });
});
