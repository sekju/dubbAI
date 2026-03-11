import { describe, expect, it } from "vitest";

import { groupTranscriptWords } from "@/lib/transcript-rendering";
import type { TranscriptWord } from "@/lib/types";

const sampleWords: TranscriptWord[] = [
  { position: 1, startMs: 0, endMs: 180, originalText: "Hello,", translatedText: "Czesc,", keyword: false },
  { position: 2, startMs: 181, endMs: 360, originalText: "brave", translatedText: "dzielny", keyword: false },
  { position: 3, startMs: 361, endMs: 520, originalText: "new", translatedText: "nowy", keyword: false },
  { position: 4, startMs: 521, endMs: 760, originalText: "world!", translatedText: "swiecie!", keyword: true },
  { position: 5, startMs: 1400, endMs: 1560, originalText: "This", translatedText: "To", keyword: false },
  { position: 6, startMs: 1561, endMs: 1760, originalText: "is", translatedText: "jest", keyword: false },
  { position: 7, startMs: 1761, endMs: 2100, originalText: "working.", translatedText: "dziala.", keyword: false }
];

describe("groupTranscriptWords", () => {
  it("groups only a few words in compact mode", () => {
    const groups = groupTranscriptWords(sampleWords, "compact", "original");

    expect(groups.map((group) => group.text)).toEqual([
      "Hello, brave new",
      "world!",
      "This is working."
    ]);
  });

  it("groups short readable phrases in balanced mode", () => {
    const groups = groupTranscriptWords(sampleWords, "balanced", "original");

    expect(groups.map((group) => group.text)).toEqual([
      "Hello, brave new world!",
      "This is working."
    ]);
  });

  it("builds a full sentence in sentence mode instead of truncating the first block", () => {
    const groups = groupTranscriptWords(sampleWords, "sentence", "original");

    expect(groups.map((group) => group.text)).toEqual([
      "Hello, brave new world!",
      "This is working."
    ]);
    expect(groups[0]?.words).toHaveLength(4);
  });

  it("preserves punctuation and can group the translated track independently", () => {
    const groups = groupTranscriptWords(sampleWords, "sentence", "translation");

    expect(groups.map((group) => group.text)).toEqual([
      "Czesc, dzielny nowy swiecie!",
      "To jest dziala."
    ]);
  });
});
